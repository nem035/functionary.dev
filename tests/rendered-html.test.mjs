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
  const [skill, schema, validator, packageJson, viewer] = await Promise.all([
    readFile(new URL("../skills/map-codebase/SKILL.md", import.meta.url), "utf8"),
    readFile(new URL("../skills/map-codebase/references/city-map-schema.md", import.meta.url), "utf8"),
    readFile(new URL("../skills/map-codebase/scripts/validate-city-map.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/RepoCity.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(skill, /name: map-codebase/);
  assert.match(skill, /\.functionary\/map\.json/);
  assert.match(schema, /schemaVersion/);
  assert.match(skill, /every building at least two direct children/i);
  assert.match(skill, /never normalize buildings to a repeated count/i);
  assert.match(skill, /Record GitHub repositories as/);
  assert.match(validator, /must contain at least two rooms/);
  assert.match(validator, /Valid Functionary City map/);
  assert.match(viewer, /function InteriorPlot/);
  assert.match(viewer, /function MapMarker/);
  assert.match(viewer, /footprintWidth, footprintDepth/);
  assert.match(viewer, /the city remains around you/);
  assert.match(viewer, /addEventListener\?\.\("start", releaseCamera\)/);
  assert.match(viewer, /function closestVisibleAncestor/);
  assert.match(viewer, /function NeighborhoodPlots/);
  assert.match(viewer, /activeEdgeId/);
  assert.match(viewer, /const focusModel/);
  assert.match(viewer, /Click a connected structure to trace that path/);
  assert.match(viewer, /focusedEdgeIds/);
  assert.doesNotMatch(viewer, /structure-label|structure-pin|interior-world-label/);
  assert.doesNotMatch(viewer, /flow-stage-label|<Html/);
  assert.doesNotMatch(viewer, /Component layer|Relationship evidence|type ViewMode|changeMode/);
  assert.doesNotMatch(viewer, /How it connects|connection-path|className="interior-preview"/);
  assert.match(viewer, /blob\/HEAD/);
  assert.match(viewer, /Escape/);
  assert.doesNotMatch(viewer, /No interior map|Selected structure|deployable · building|Explore \{selectedChildren\.length\} room/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});
