import type { CityEdge, CityNode } from "./city-map";

export type FlowLayout = {
  positions: Map<string, [number, number]>;
  layers: Map<string, number>;
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
    return { positions: new Map(), layers: new Map(), bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 } };
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

  const scopeOrder = new Map(
    allNodes.filter((node) => node.kind === "scope").map((node, index) => [node.id, index]),
  );
  const byLayer = new Map<number, CityNode[]>();
  nodes.forEach((node) => {
    const layer = layers.get(node.id)!;
    byLayer.set(layer, [...(byLayer.get(layer) ?? []), node]);
  });

  const positions = new Map<string, [number, number]>();
  for (const [layer, layerNodes] of byLayer) {
    layerNodes.sort((a, b) =>
      (a.display?.flowOrder ?? Number.MAX_SAFE_INTEGER) - (b.display?.flowOrder ?? Number.MAX_SAFE_INTEGER) ||
      (scopeOrder.get(a.parentId ?? "") ?? 999) - (scopeOrder.get(b.parentId ?? "") ?? 999) ||
      a.label.localeCompare(b.label),
    );
    const spacing = 2.65 + layer * 0.18;
    const z = (maxLayer / 2 - layer) * 3.15;
    layerNodes.forEach((node, index) => {
      const x = (index - (layerNodes.length - 1) / 2) * spacing;
      positions.set(node.id, [x, z]);
    });
  }

  const extents = nodes.map((node) => {
    const [x, z] = positions.get(node.id)!;
    const [width, , depth] = node.display?.size ?? [1.65, 1.2, 1.4];
    return { minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 };
  });

  return {
    positions,
    layers,
    bounds: {
      minX: Math.min(...extents.map((extent) => extent.minX)),
      maxX: Math.max(...extents.map((extent) => extent.maxX)),
      minZ: Math.min(...extents.map((extent) => extent.minZ)),
      maxZ: Math.max(...extents.map((extent) => extent.maxZ)),
    },
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
