#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RELATIONSHIP_LIMIT = 120;
const SEMANTIC_RELATIONSHIP_TYPES = [
  "CALLS", "IMPORTS", "HTTP_CALLS", "ASYNC_CALLS", "HANDLES", "WRITES",
  "IMPLEMENTS", "CONFIGURES", "TESTS", "USES_TYPE", "CALL_REFERENCE", "USAGE",
];
const SEMANTIC_RELATIONSHIPS = new Set(SEMANTIC_RELATIONSHIP_TYPES);

function parseArguments(argv) {
  const options = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (["--backend", "--output"].includes(value)) {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) throw new Error(`${value} requires a value.`);
      options[value.slice(2)] = next;
      index += 1;
    } else if (value.startsWith("--")) throw new Error(`Unknown option: ${value}`);
    else positionals.push(value);
  }
  if (!positionals[0]) throw new Error("Usage: collect-code-graph-evidence.mjs <repository> --backend <codebase-memory-mcp> [--output path]");
  if (!options.backend) throw new Error("--backend requires the codebase-memory-mcp executable path.");
  return { repository: resolve(positionals[0]), ...options };
}

function runJson(command, args, environment) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `${command} exited with code ${code}.`));
        return;
      }
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      const candidate = lines.at(-1);
      try {
        resolvePromise(JSON.parse(candidate));
      } catch {
        reject(new Error(`Codebase Memory returned invalid JSON${stderr.trim() ? `: ${stderr.trim()}` : "."}`));
      }
    });
  });
}

function take(value, limit) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

function compactArchitecture(architecture) {
  const compact = {};
  for (const key of ["project", "total_nodes", "total_edges", "node_labels", "edge_types", "languages"]) {
    if (architecture[key] !== undefined) compact[key] = architecture[key];
  }
  for (const key of ["packages", "entry_points", "routes", "resources", "hotspots", "boundaries", "layers"]) {
    if (Array.isArray(architecture[key])) compact[key] = take(architecture[key], 100);
  }
  if (Array.isArray(architecture.clusters)) {
    compact.clusters = architecture.clusters.slice(0, 30).map((cluster) => ({
      ...cluster,
      top_nodes: take(cluster.top_nodes, 12),
      packages: take(cluster.packages, 12),
      edge_types: take(cluster.edge_types, 12),
    }));
  }
  return compact;
}

function normalizeRelationships(result) {
  const columns = Array.isArray(result.columns) ? result.columns : [];
  return (Array.isArray(result.rows) ? result.rows : [])
    .map((row) => Object.fromEntries(
      columns.map((column, index) => [column, row[index]]).filter(([, value]) => value !== null && value !== undefined),
    ))
    .filter((relationship) => SEMANTIC_RELATIONSHIPS.has(relationship.relationship))
    .slice(0, RELATIONSHIP_LIMIT);
}

export async function collectCodeGraphEvidence({ repository, backend }) {
  const cacheDirectory = await mkdtemp(join(tmpdir(), "functionary-code-evidence-"));
  const environment = {
    ...process.env,
    CBM_CACHE_DIR: cacheDirectory,
    CBM_ALLOWED_ROOT: repository,
    CBM_LOG_LEVEL: process.env.CBM_LOG_LEVEL ?? "error",
    CBM_MEM_BUDGET_MB: process.env.CBM_MEM_BUDGET_MB ?? "4096",
  };
  try {
    const index = await runJson(backend, [
      "cli",
      "index_repository",
      "--repo-path", repository,
      "--persistence", "false",
    ], environment);
    const project = index.project;
    if (!project) throw new Error("Codebase Memory did not return an indexed project name.");

    const [graphSchema, architecture, relationshipResult] = await Promise.all([
      runJson(backend, ["cli", "get_graph_schema", "--project", project], environment),
      runJson(backend, ["cli", "get_architecture", "--project", project], environment),
      runJson(backend, [
        "cli",
        "query_graph",
        "--project", project,
        "--query",
        `MATCH (source)-[relationship:${SEMANTIC_RELATIONSHIP_TYPES.join("|")}]->(target)
         RETURN source.name AS source_name, source.file_path AS source_path,
                type(relationship) AS relationship, target.name AS target_name, target.file_path AS target_path,
                relationship.line AS line, relationship.confidence AS confidence
         LIMIT ${RELATIONSHIP_LIMIT}`,
      ], environment),
    ]);

    return {
      schemaVersion: 1,
      backend: { name: "codebase-memory-mcp" },
      repository,
      generatedAt: new Date().toISOString(),
      index: {
        project,
        nodes: index.nodes,
        edges: index.edges,
        skippedCount: index.skipped_count,
      },
      architecture: compactArchitecture(architecture),
      graphSchema: {
        nodeLabels: take(graphSchema.node_labels, 100).map(({ label, count }) => ({ label, count })),
        edgeTypes: take(graphSchema.edge_types, 100).map(({ type, count }) => ({ type, count })),
      },
      relationships: normalizeRelationships(relationshipResult),
      limitations: [
        "Derived from static code analysis; verify architectural claims in repository source and configuration.",
        `Relationship samples are capped at ${RELATIONSHIP_LIMIT} rows and are not a complete runtime trace.`,
      ],
    };
  } finally {
    await rm(cacheDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const evidence = await collectCodeGraphEvidence(options);
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  if (options.output) {
    await writeFile(resolve(options.output), serialized, "utf8");
    JSON.parse(await readFile(resolve(options.output), "utf8"));
  } else {
    process.stdout.write(serialized);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
