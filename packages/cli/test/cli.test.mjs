import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const bin = resolve("bin/repo-city.mjs");
const collector = resolve("../../skills/map-codebase/scripts/collect-code-graph-evidence.mjs");

async function createFakeCodebaseMemory(root) {
  const path = join(root, "fake-codebase-memory.mjs");
  await writeFile(path, `#!/usr/bin/env node
const tool = process.argv.slice(2)[1];
const payloads = {
  index_repository: { project: "fixture", nodes: 9, edges: 10, skipped_count: 0 },
  get_graph_schema: { node_labels: [{ label: "Function", count: 2 }], edge_types: [{ type: "CALLS", count: 1 }] },
  get_architecture: { project: "fixture", total_nodes: 9, total_edges: 10, languages: [{ language: "JavaScript", file_count: 2 }], entry_points: [{ name: "handleRequest", file: "src/main.js" }] },
  query_graph: { columns: ["source_name", "relationship", "target_name", "source_path", "target_path"], rows: [["handleRequest", "CALLS", "greet", "src/main.js", "src/service.js"]] }
};
if (!payloads[tool]) process.exit(2);
process.stdout.write(JSON.stringify(payloads[tool]) + "\\n");
`);
  await chmod(path, 0o755);
  return path;
}

test("prints installable CLI help", () => {
  const result = spawnSync(process.execPath, [bin, "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /functionary map/);
  assert.match(result.stdout, /any AI coding agent/);
  assert.match(result.stdout, /--agent-command/);
  assert.match(result.stdout, /--evidence auto/);
});

test("creates a portable prompt without launching an agent", async () => {
  const root = await mkdtemp(join(tmpdir(), "functionary-prompt-"));
  const promptPath = join(root, "prompt.md");
  const result = spawnSync(process.execPath, [
    bin, "prompt", root,
    "--prompt-output", promptPath,
    "--evidence", "none",
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const prompt = await readFile(promptPath, "utf8");
  assert.match(prompt, /agent-neutral map-codebase skill/);
  assert.match(prompt, /Return only the complete Functionary City JSON object/);
});

test("maps with an arbitrary agent command using the portable protocol", async () => {
  const root = await mkdtemp(join(tmpdir(), "functionary-agent-"));
  const agent = join(root, "fake-agent.mjs");
  const promptPath = join(root, "received-prompt.md");
  const output = join(root, "map.json");
  await writeFile(agent, `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
let prompt = "";
for await (const chunk of process.stdin) prompt += chunk;
writeFileSync(process.env.FUNCTIONARY_TEST_PROMPT, prompt);
writeFileSync(process.env.FUNCTIONARY_OUTPUT, JSON.stringify({ schemaVersion: 1, id: "portable", name: "Portable agent", nodes: [{ id: "system", label: "System", kind: "scope", archetype: "district" }, { id: "gateway", label: "Gateway", kind: "module", archetype: "gateway", parentId: "system" }], edges: [] }));
`);
  await chmod(agent, 0o755);

  const result = spawnSync(process.execPath, [
    bin, "map", root,
    "--output", output,
    "--agent-command", agent,
    "--agent-arg=--fixture",
    "--evidence", "none",
  ], { encoding: "utf8", env: { ...process.env, FUNCTIONARY_TEST_PROMPT: promptPath } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Agent runner:/);
  assert.match(await readFile(promptPath, "utf8"), /agent-neutral map-codebase skill/);
  const map = JSON.parse(await readFile(output, "utf8"));
  assert.equal(map.name, "Portable agent");
});

test("accepts map JSON returned by an arbitrary agent on stdout", async () => {
  const root = await mkdtemp(join(tmpdir(), "functionary-agent-stdout-"));
  const agent = join(root, "stdout-agent.mjs");
  const output = join(root, "map.json");
  await writeFile(agent, `#!/usr/bin/env node
for await (const _chunk of process.stdin) {}
process.stdout.write(JSON.stringify({ schemaVersion: 1, id: "stdout", name: "Stdout agent", nodes: [{ id: "system", label: "System", kind: "scope", archetype: "district" }, { id: "gateway", label: "Gateway", kind: "module", archetype: "gateway", parentId: "system" }], edges: [] }));
`);
  await chmod(agent, 0o755);

  const result = spawnSync(process.execPath, [
    bin, "map", root,
    "--output", output,
    "--agent-command", agent,
    "--evidence", "none",
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const map = JSON.parse(await readFile(output, "utf8"));
  assert.equal(map.name, "Stdout agent");
});

test("collects a compact static code evidence bundle", async () => {
  const root = await mkdtemp(join(tmpdir(), "functionary-evidence-"));
  const backend = await createFakeCodebaseMemory(root);
  const output = join(root, "evidence.json");
  const result = spawnSync(process.execPath, [collector, root, "--backend", backend, "--output", output], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const evidence = JSON.parse(await readFile(output, "utf8"));
  assert.equal(evidence.backend.name, "codebase-memory-mcp");
  assert.equal(evidence.index.nodes, 9);
  assert.equal(evidence.architecture.entry_points[0].file, "src/main.js");
  assert.deepEqual(evidence.relationships[0], {
    source_name: "handleRequest",
    relationship: "CALLS",
    target_name: "greet",
    source_path: "src/main.js",
    target_path: "src/service.js",
  });
});

test("adds optional code graph evidence to the mapping agent prompt", async () => {
  const root = await mkdtemp(join(tmpdir(), "functionary-map-evidence-"));
  const backend = await createFakeCodebaseMemory(root);
  const codex = join(root, "fake-codex.mjs");
  const promptPath = join(root, "prompt.txt");
  const output = join(root, "map.json");
  await writeFile(codex, `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output-last-message");
writeFileSync(process.env.FUNCTIONARY_TEST_PROMPT, args.at(-1));
writeFileSync(args[outputIndex + 1], JSON.stringify({ schemaVersion: 1, id: "fixture", name: "Fixture", nodes: [{ id: "system", label: "System", kind: "scope", archetype: "district" }, { id: "gateway", label: "Gateway", kind: "module", archetype: "gateway", parentId: "system" }], edges: [] }));
`);
  await chmod(codex, 0o755);

  const result = spawnSync(process.execPath, [
    bin, "map", root,
    "--output", output,
    "--codex", codex,
    "--evidence", "codebase-memory",
    "--codebase-memory", backend,
  ], { encoding: "utf8", env: { ...process.env, FUNCTIONARY_TEST_PROMPT: promptPath } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Indexing static code relationships/);
  const prompt = await readFile(promptPath, "utf8");
  assert.match(prompt, /functionary-code-graph-evidence/);
  assert.match(prompt, /handleRequest/);
  assert.match(prompt, /derived static evidence, not runtime truth/);
});

test("validates a repository map", async () => {
  const root = await mkdtemp(join(tmpdir(), "functionary-cli-"));
  const mapDirectory = join(root, ".functionary");
  const mapPath = join(mapDirectory, "map.json");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(mapDirectory));
  await writeFile(mapPath, JSON.stringify({
    schemaVersion: 1,
    id: "example",
    name: "Example",
    nodes: [
      { id: "domain", label: "Domain", kind: "scope", archetype: "district" },
      { id: "app", label: "App", kind: "deployable", archetype: "building", parentId: "domain" }
    ],
    edges: []
  }));
  const result = spawnSync(process.execPath, [bin, "validate", root], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Valid Functionary City map/);
});

test("requires every flow-map building to have meaningful rooms", async () => {
  const root = await mkdtemp(join(tmpdir(), "functionary-building-"));
  const mapPath = join(root, "map.json");
  const map = {
    schemaVersion: 1,
    id: "building-contract",
    name: "Building contract",
    nodes: [
      { id: "domain", label: "Domain", kind: "scope", archetype: "district" },
      { id: "app", label: "App", kind: "deployable", archetype: "building", parentId: "domain", display: { flowLayer: 0 } },
    ],
    edges: [],
  };

  await writeFile(mapPath, JSON.stringify(map));
  const invalid = spawnSync(process.execPath, [bin, "validate", mapPath], { encoding: "utf8" });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /must contain at least two rooms/);

  map.nodes.push(
    { id: "input", label: "Input", kind: "module", archetype: "room", parentId: "app", display: { flowLayer: 0 } },
    { id: "work", label: "Work", kind: "module", archetype: "room", parentId: "app", display: { flowLayer: 1 } },
  );
  await writeFile(mapPath, JSON.stringify(map));
  const valid = spawnSync(process.execPath, [bin, "validate", mapPath], { encoding: "utf8" });
  assert.equal(valid.status, 0, valid.stderr);
});
