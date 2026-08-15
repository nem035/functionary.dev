import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Functionary atlas and metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Functionary — See how the whole repository flows<\/title>/i);
  assert.match(html, /functionary\.dev/i);
  assert.match(html, /Famous systems/i);
  assert.match(html, /Map your repository/i);
  assert.match(html, /http:\/\/localhost\/og\.png/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("ships the map skill and removes disposable starter files", async () => {
  const [skill, schema, validator, packageJson] = await Promise.all([
    readFile(new URL("../skills/map-codebase/SKILL.md", import.meta.url), "utf8"),
    readFile(new URL("../skills/map-codebase/references/city-map-schema.md", import.meta.url), "utf8"),
    readFile(new URL("../skills/map-codebase/scripts/validate-city-map.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(skill, /name: map-codebase/);
  assert.match(skill, /\.functionary\/map\.json/);
  assert.match(schema, /schemaVersion/);
  assert.match(validator, /Valid Functionary City map/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});
