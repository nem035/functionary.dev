#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const nodeKinds = new Set(["scope", "deployable", "module", "infra", "external"]);
const archetypes = new Set(["district", "building", "room", "gateway", "worker", "database", "queue", "storage", "cloud"]);
const edgeKinds = new Set(["depends_on", "calls", "data_flow", "deploys"]);
const evidenceKinds = new Set(["declared", "observed", "inferred"]);

function validate(map) {
  const errors = [];
  if (!map || typeof map !== "object" || Array.isArray(map)) return ["Map must be a JSON object."];
  if (map.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  if (typeof map.id !== "string" || !map.id.trim()) errors.push("id must be a non-empty string.");
  if (typeof map.name !== "string" || !map.name.trim()) errors.push("name must be a non-empty string.");
  if (!Array.isArray(map.nodes)) errors.push("nodes must be an array.");
  if (!Array.isArray(map.edges)) errors.push("edges must be an array.");
  if (errors.length) return errors;

  const ids = new Set();
  const parents = new Map();
  map.nodes.forEach((node, index) => {
    const at = `nodes[${index}]`;
    if (!node || typeof node !== "object" || Array.isArray(node)) { errors.push(`${at} must be an object.`); return; }
    if (typeof node.id !== "string" || !node.id.trim()) errors.push(`${at}.id must be a non-empty string.`);
    else if (ids.has(node.id)) errors.push(`${at}.id duplicates "${node.id}".`);
    else ids.add(node.id);
    if (typeof node.label !== "string" || !node.label.trim()) errors.push(`${at}.label must be a non-empty string.`);
    if (!nodeKinds.has(node.kind)) errors.push(`${at}.kind "${node.kind}" is not supported.`);
    if (!archetypes.has(node.archetype)) errors.push(`${at}.archetype "${node.archetype}" is not supported.`);
    if (node.parentId !== undefined) parents.set(node.id, node.parentId);
    if (node.display?.position && (!Array.isArray(node.display.position) || node.display.position.length !== 2 || node.display.position.some((v) => !Number.isFinite(v)))) errors.push(`${at}.display.position must contain two finite numbers.`);
    if (node.display?.size && (!Array.isArray(node.display.size) || node.display.size.length !== 3 || node.display.size.some((v) => !Number.isFinite(v) || v <= 0))) errors.push(`${at}.display.size must contain three positive finite numbers.`);
    if (node.display?.flowLayer !== undefined && (!Number.isInteger(node.display.flowLayer) || node.display.flowLayer < 0)) errors.push(`${at}.display.flowLayer must be a non-negative integer.`);
    if (node.display?.flowOrder !== undefined && (!Number.isFinite(node.display.flowOrder) || node.display.flowOrder < 0)) errors.push(`${at}.display.flowOrder must be a non-negative number.`);
  });

  for (const [id, parentId] of parents) {
    if (!ids.has(parentId)) errors.push(`Node "${id}" references missing parent "${parentId}".`);
    const seen = new Set([id]);
    let cursor = parentId;
    while (cursor) {
      if (seen.has(cursor)) { errors.push(`Containment cycle includes "${id}" and "${cursor}".`); break; }
      seen.add(cursor);
      cursor = parents.get(cursor);
    }
  }

  const usesFlowContract = map.nodes.some((node) => node.display?.flowLayer !== undefined);
  if (usesFlowContract) {
    map.nodes.filter((node) => node.archetype === "building").forEach((building) => {
      const rooms = map.nodes.filter((node) => node.parentId === building.id && node.archetype === "room");
      if (rooms.length < 2) errors.push(`Building "${building.id}" must contain at least two rooms. Use a leaf archetype when there is no meaningful interior.`);
    });
  }

  const edgeIds = new Set();
  map.edges.forEach((edge, index) => {
    const at = `edges[${index}]`;
    if (!edge || typeof edge !== "object" || Array.isArray(edge)) { errors.push(`${at} must be an object.`); return; }
    if (typeof edge.id !== "string" || !edge.id.trim()) errors.push(`${at}.id must be a non-empty string.`);
    else if (edgeIds.has(edge.id)) errors.push(`${at}.id duplicates "${edge.id}".`);
    else edgeIds.add(edge.id);
    if (!ids.has(edge.from)) errors.push(`${at}.from references missing node "${edge.from}".`);
    if (!ids.has(edge.to)) errors.push(`${at}.to references missing node "${edge.to}".`);
    if (!edgeKinds.has(edge.kind)) errors.push(`${at}.kind "${edge.kind}" is not supported.`);
    if (!evidenceKinds.has(edge.evidence)) errors.push(`${at}.evidence "${edge.evidence}" is not supported.`);
    if (edge.confidence !== undefined && (!Number.isFinite(edge.confidence) || edge.confidence < 0 || edge.confidence > 1)) errors.push(`${at}.confidence must be between 0 and 1.`);
    if (edge.evidence === "inferred" && edge.confidence === undefined) errors.push(`${at} is inferred and must include confidence.`);
  });

  return [...new Set(errors)];
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: validate-city-map.mjs <map.json>");
  process.exit(2);
}

try {
  const map = JSON.parse(await readFile(resolve(file), "utf8"));
  const errors = validate(map);
  if (errors.length) {
    console.error(`Invalid Functionary City map (${errors.length} problem${errors.length === 1 ? "" : "s"}):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }
  console.log(`Valid Functionary City map: ${map.name} (${map.nodes.length} nodes, ${map.edges.length} edges)`);
} catch (error) {
  console.error(`Could not validate map: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
