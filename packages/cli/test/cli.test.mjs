import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const bin = resolve("bin/repo-city.mjs");

test("prints installable CLI help", () => {
  const result = spawnSync(process.execPath, [bin, "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /functionary map/);
  assert.match(result.stdout, /read-only repository access/);
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
