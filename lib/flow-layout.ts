import type { CityEdge, CityNode } from "./city-map";

export type FlowLayout = {
  positions: Map<string, [number, number]>;
  layers: Map<string, number>;
  neighborhoods: Array<{
    id: string;
    label: string;
    description?: string;
    nodeIds: string[];
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  }>;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
};

const STAGE_HINTS: Array<[RegExp, number]> = [
  [/\b(ui|ux|frontend|front-end|web app|client|public api|sdk|command|cli|ingress|gateway|http|graphql|rest|entry|input)\b/i, 0],
  [/\b(router|route|controller|orchestrat|service|server|handler|dispatcher|api server)\b/i, 1],
  [/\b(core|domain|engine|compiler|reconciler|processor|transform|model|planner|scheduler|runtime)\b/i, 2],
  [/\b(worker|job|consumer|queue|stream|event|background|replication|controller manager)\b/i, 3],
  [/\b(database|postgres|mysql|sqlite|redis|cache|storage|bucket|filesystem|persistence|etcd|warehouse|index)\b/i, 4],
];

function hintedStage(node: CityNode) {
  if (Number.isInteger(node.display?.flowLayer)) return Math.max(0, node.display!.flowLayer!);
  if (node.kind === "external") return 4;
  if (node.archetype === "database" || node.archetype === "storage") return 4;
  if (node.archetype === "queue" || node.archetype === "worker") return 3;

  const searchable = [node.label, node.description, ...(node.tags ?? [])].filter(Boolean).join(" ");
  for (const [pattern, stage] of STAGE_HINTS) if (pattern.test(searchable)) return stage;
  if (node.archetype === "gateway") return 0;
  if (node.kind === "infra") return 3;
  if (node.kind === "module") return 2;
  return 1;
}

function flowEdges(nodes: CityNode[], edges: CityEdge[]) {
  const ids = new Set(nodes.map((node) => node.id));
  const primary = edges.filter((edge) => edge.kind !== "deploys" && ids.has(edge.from) && ids.has(edge.to));
  return primary.length ? primary : edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
}

export function computeFlowLayout(nodes: CityNode[], edges: CityEdge[], allNodes: CityNode[]): FlowLayout {
  if (!nodes.length) {
    return { positions: new Map(), layers: new Map(), neighborhoods: [], bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 } };
  }

  const relevantEdges = flowEdges(nodes, edges);
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  relevantEdges.forEach((edge) => {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  });

  let entries = nodes.filter((node) =>
    node.display?.flowLayer === 0 ||
    (hintedStage(node) === 0 && node.kind !== "external") ||
    ((incoming.get(node.id) ?? 0) === 0 && (outgoing.get(node.id)?.length ?? 0) > 0 && node.kind !== "infra" && node.kind !== "external"),
  );
  if (!entries.length) {
    const firstStage = Math.min(...nodes.map(hintedStage));
    entries = nodes.filter((node) => hintedStage(node) === firstStage);
  }

  const distance = new Map<string, number>();
  const queue = entries.map((node) => node.id);
  queue.forEach((id) => distance.set(id, 0));
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const from = queue[cursor];
    const nextDistance = (distance.get(from) ?? 0) + 1;
    for (const to of outgoing.get(from) ?? []) {
      if (!distance.has(to) || nextDistance < distance.get(to)!) {
        distance.set(to, nextDistance);
        queue.push(to);
      }
    }
  }

  const rawLayers = new Map<string, number>();
  nodes.forEach((node) => {
    const explicit = node.display?.flowLayer;
    const graphStage = distance.get(node.id);
    const stage = explicit ?? Math.max(hintedStage(node), graphStage ?? 0);
    rawLayers.set(node.id, Math.min(stage, 6));
  });

  const usedLayers = [...new Set(rawLayers.values())].sort((a, b) => a - b);
  const compactLayer = new Map(usedLayers.map((layer, index) => [layer, index]));
  const layers = new Map([...rawLayers].map(([id, layer]) => [id, compactLayer.get(layer)!]));
  const maxLayer = Math.max(...layers.values(), 0);

  const scopes = allNodes.filter((node) => node.kind === "scope");
  const scopeById = new Map(scopes.map((scope) => [scope.id, scope]));
  const scopeOrder = new Map(scopes.map((scope, index) => [scope.id, index]));
  const neighborhoodFor = (node: CityNode) => node.parentId && scopeById.has(node.parentId) ? node.parentId : "__system";
  const groupedNodes = new Map<string, CityNode[]>();
  nodes.forEach((node) => {
    const neighborhoodId = neighborhoodFor(node);
    groupedNodes.set(neighborhoodId, [...(groupedNodes.get(neighborhoodId) ?? []), node]);
  });
  const neighborhoodEntries = [...groupedNodes].sort(([left], [right]) =>
    (scopeOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (scopeOrder.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right),
  );
  const nodeStepX = 4.4;
  const nodeStepZ = 2.7;
  const layerStepZ = 5.5;
  const neighborhoodGap = 3.2;
  const neighborhoodWidths = neighborhoodEntries.map(([, neighborhoodNodes]) => {
    const largestCell = Math.max(...[...new Set(neighborhoodNodes.map((node) => layers.get(node.id)!))]
      .map((layer) => neighborhoodNodes.filter((node) => layers.get(node.id) === layer).length), 1);
    return Math.max(7.2, Math.min(2, largestCell) * nodeStepX + 1.8);
  });
  const totalWidth = neighborhoodWidths.reduce((total, width) => total + width, 0) + neighborhoodGap * Math.max(0, neighborhoodWidths.length - 1);
  const positions = new Map<string, [number, number]>();
  let neighborhoodCursor = -totalWidth / 2;
  neighborhoodEntries.forEach(([, neighborhoodNodes], neighborhoodIndex) => {
    const neighborhoodWidth = neighborhoodWidths[neighborhoodIndex];
    const centerX = neighborhoodCursor + neighborhoodWidth / 2;
    const localLayers = new Map<number, CityNode[]>();
    neighborhoodNodes.forEach((node) => {
      const layer = layers.get(node.id)!;
      localLayers.set(layer, [...(localLayers.get(layer) ?? []), node]);
    });
    for (const [layer, layerNodes] of localLayers) {
      layerNodes.sort((a, b) =>
        (a.display?.flowOrder ?? Number.MAX_SAFE_INTEGER) - (b.display?.flowOrder ?? Number.MAX_SAFE_INTEGER) || a.label.localeCompare(b.label),
      );
      const columnCount = Math.min(2, layerNodes.length);
      const rowCount = Math.ceil(layerNodes.length / columnCount);
      layerNodes.forEach((node, index) => {
        const row = Math.floor(index / columnCount);
        const column = index % columnCount;
        const nodesInRow = Math.min(columnCount, layerNodes.length - row * columnCount);
        const x = centerX + (column - (nodesInRow - 1) / 2) * nodeStepX;
        const z = (maxLayer / 2 - layer) * layerStepZ + (row - (rowCount - 1) / 2) * nodeStepZ;
        positions.set(node.id, [x, z]);
      });
    }
    neighborhoodCursor += neighborhoodWidth + neighborhoodGap;
  });

  const neighborhoods = neighborhoodEntries.map(([id, neighborhoodNodes]) => {
    const neighborhoodExtents = neighborhoodNodes.map((node) => {
      const [x, z] = positions.get(node.id)!;
      const [width, , depth] = node.display?.size ?? [1.65, 1.2, 1.4];
      const hasInterior = allNodes.some((candidate) => candidate.parentId === node.id);
      const labelLength = node.label.length + (hasInterior ? 3 : 0);
      const plaqueWidth = hasInterior
        ? Math.max(3.15, Math.min(4.7, 2.1 + labelLength * 0.065))
        : node.kind === "external"
          ? Math.max(2.35, Math.min(3.65, 1.75 + labelLength * 0.05))
          : Math.max(2.6, Math.min(4.1, 1.9 + labelLength * 0.058));
      const plaqueHeight = hasInterior ? 1.02 : node.kind === "external" ? 0.76 : 0.88;
      const footprintDepth = depth + 0.24;
      const plaqueFarZ = z + footprintDepth / 2 + plaqueHeight + 0.18;
      return {
        minX: Math.min(x - width / 2, x - plaqueWidth / 2),
        maxX: Math.max(x + width / 2, x + plaqueWidth / 2),
        minZ: z - depth / 2,
        maxZ: plaqueFarZ,
      };
    });
    const scope = scopeById.get(id);
    return {
      id,
      label: scope?.label ?? "System",
      description: scope?.description,
      nodeIds: neighborhoodNodes.map((node) => node.id),
      bounds: {
        minX: Math.min(...neighborhoodExtents.map((extent) => extent.minX)) - 1.1,
        maxX: Math.max(...neighborhoodExtents.map((extent) => extent.maxX)) + 1.1,
        minZ: Math.min(...neighborhoodExtents.map((extent) => extent.minZ)) - 1.25,
        maxZ: Math.max(...neighborhoodExtents.map((extent) => extent.maxZ)) + 1.65,
      },
    };
  });

  const neighborhoodBounds = neighborhoods.map((neighborhood) => neighborhood.bounds);
  const bounds = {
    minX: Math.min(...neighborhoodBounds.map((item) => item.minX)),
    maxX: Math.max(...neighborhoodBounds.map((item) => item.maxX)),
    minZ: Math.min(...neighborhoodBounds.map((item) => item.minZ)),
    maxZ: Math.max(...neighborhoodBounds.map((item) => item.maxZ)) + 0.65,
  };

  return {
    positions,
    layers,
    neighborhoods,
    bounds,
  };
}

export function flowStageLabel(layer: number, maxLayer: number) {
  if (layer === 0) return "Entry points";
  if (layer === maxLayer) return "State & external";
  const ratio = layer / Math.max(1, maxLayer);
  if (ratio <= 0.34) return "Orchestration";
  if (ratio <= 0.68) return "Core compute";
  return "Runtime & data";
}
