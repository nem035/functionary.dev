export const CITY_MAP_SCHEMA_VERSION = 1 as const;

export type NodeKind = "scope" | "deployable" | "module" | "infra" | "external";
export type Archetype = "district" | "building" | "room" | "gateway" | "worker" | "database" | "queue" | "storage" | "cloud";
export type EdgeKind = "depends_on" | "calls" | "data_flow" | "deploys";
export type EvidenceKind = "declared" | "observed" | "inferred";

export type SourceRef = {
  path?: string;
  line?: number;
  url?: string;
  note?: string;
};

export type CityNode = {
  id: string;
  label: string;
  kind: NodeKind;
  archetype: Archetype;
  parentId?: string;
  description?: string;
  sourceRefs?: SourceRef[];
  metrics?: Record<string, number>;
  tags?: string[];
  display?: {
    position?: [number, number];
    size?: [number, number, number];
    color?: string;
  };
};

export type CityEdge = {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  evidence: EvidenceKind;
  confidence?: number;
  label?: string;
  weight?: number;
  sourceRefs?: SourceRef[];
};

export type CityMap = {
  schemaVersion: typeof CITY_MAP_SCHEMA_VERSION;
  id: string;
  name: string;
  repository?: string;
  summary?: string;
  generatedAt?: string;
  nodes: CityNode[];
  edges: CityEdge[];
  warnings?: string[];
};

const NODE_KINDS = new Set<NodeKind>(["scope", "deployable", "module", "infra", "external"]);
const ARCHETYPES = new Set<Archetype>(["district", "building", "room", "gateway", "worker", "database", "queue", "storage", "cloud"]);
const EDGE_KINDS = new Set<EdgeKind>(["depends_on", "calls", "data_flow", "deploys"]);
const EVIDENCE = new Set<EvidenceKind>(["declared", "observed", "inferred"]);

export function validateCityMap(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object") return ["Map must be a JSON object."];
  const map = value as Partial<CityMap>;
  if (map.schemaVersion !== CITY_MAP_SCHEMA_VERSION) errors.push(`schemaVersion must be ${CITY_MAP_SCHEMA_VERSION}.`);
  if (!map.id || typeof map.id !== "string") errors.push("id must be a non-empty string.");
  if (!map.name || typeof map.name !== "string") errors.push("name must be a non-empty string.");
  if (!Array.isArray(map.nodes)) errors.push("nodes must be an array.");
  if (!Array.isArray(map.edges)) errors.push("edges must be an array.");
  if (errors.length) return errors;

  const ids = new Set<string>();
  map.nodes!.forEach((node, index) => {
    const prefix = `nodes[${index}]`;
    if (!node || typeof node !== "object") { errors.push(`${prefix} must be an object.`); return; }
    if (!node.id || typeof node.id !== "string") errors.push(`${prefix}.id must be a non-empty string.`);
    else if (ids.has(node.id)) errors.push(`${prefix}.id duplicates "${node.id}".`);
    else ids.add(node.id);
    if (!node.label || typeof node.label !== "string") errors.push(`${prefix}.label must be a non-empty string.`);
    if (!NODE_KINDS.has(node.kind)) errors.push(`${prefix}.kind is not supported.`);
    if (!ARCHETYPES.has(node.archetype)) errors.push(`${prefix}.archetype is not supported.`);
  });

  map.nodes!.forEach((node) => {
    if (node.parentId && !ids.has(node.parentId)) errors.push(`Node "${node.id}" references missing parent "${node.parentId}".`);
  });

  const edgeIds = new Set<string>();
  map.edges!.forEach((edge, index) => {
    const prefix = `edges[${index}]`;
    if (!edge || typeof edge !== "object") { errors.push(`${prefix} must be an object.`); return; }
    if (!edge.id || typeof edge.id !== "string") errors.push(`${prefix}.id must be a non-empty string.`);
    else if (edgeIds.has(edge.id)) errors.push(`${prefix}.id duplicates "${edge.id}".`);
    else edgeIds.add(edge.id);
    if (!ids.has(edge.from)) errors.push(`${prefix}.from references missing node "${edge.from}".`);
    if (!ids.has(edge.to)) errors.push(`${prefix}.to references missing node "${edge.to}".`);
    if (!EDGE_KINDS.has(edge.kind)) errors.push(`${prefix}.kind is not supported.`);
    if (!EVIDENCE.has(edge.evidence)) errors.push(`${prefix}.evidence is not supported.`);
    if (edge.confidence !== undefined && (edge.confidence < 0 || edge.confidence > 1)) errors.push(`${prefix}.confidence must be between 0 and 1.`);
  });

  return errors;
}
