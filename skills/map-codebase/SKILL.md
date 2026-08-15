---
name: map-codebase
description: Inspect any software repository and translate its meaningful architecture into a validated Repo City JSON map. Use when Codex needs to visualize, explain, or map a codebase as districts, buildings, rooms, infrastructure, external systems, and evidence-backed relationships; when creating or refreshing a `.repo-city/map.json`; or when preparing data for the Repo City 3D viewer.
---

# Map Codebase

Interpret the repository as an architecture, not as a directory tree. Produce `.repo-city/map.json` using the Repo City schema.

## Workflow

1. Establish the repository root and inspect local agent instructions before acting.
2. Inventory the repository with targeted reads:
   - List files with `rg --files`, excluding generated, vendored, cache, and dependency directories.
   - Read architecture documentation, workspace manifests, build definitions, container files, CI workflows, and infrastructure configuration.
   - Inspect representative entry points and dependency declarations before reading implementation broadly.
3. Infer the repository's natural architectural units:
   - Use `scope` nodes for domains, bounded contexts, major products, or teams.
   - Use `deployable` nodes for independently built or executed applications, services, workers, CLIs, and jobs.
   - Use `module` nodes only for meaningful internal boundaries inside a deployable.
   - Use `infra` nodes for databases, queues, storage, gateways, clusters, and other operational resources.
   - Use `external` nodes for systems outside the repository's ownership boundary.
4. Trace important relationships from manifests, imports, configuration, infrastructure references, and runtime evidence when available.
5. Assign evidence honestly:
   - Mark explicit configuration or resolved references as `declared`.
   - Mark telemetry, traces, logs, or other runtime facts as `observed`.
   - Mark architectural conclusions or unresolved static references as `inferred`, with a calibrated confidence value.
6. Read [references/city-map-schema.md](references/city-map-schema.md) completely before writing the map.
7. Create or update `.repo-city/map.json`. Preserve stable IDs from an existing map whenever the underlying component is the same.
8. Validate the result:

   ```bash
   node <skill-directory>/scripts/validate-city-map.mjs .repo-city/map.json
   ```

9. Repair validation failures. Report the output path, map counts, warnings, and important uncertain interpretations.

## Interpretation Rules

- Prefer architectural meaning over folder depth.
- Make deployables or major infrastructure resources the campus-level buildings.
- Make packages, subsystems, or cohesive source areas the rooms inside a building.
- Collapse repetitive files, tests, generated code, fixtures, migrations, and third-party dependencies unless they are architecturally significant.
- Keep campus maps readable. Prefer 5–40 top-level structures and drill-down interiors over hundreds of buildings.
- Attach `sourceRefs` to every significant node and inferred edge when evidence is available.
- Never claim runtime behavior from static code alone.
- Keep organizational containment and deployment relationships separate. Represent deployment with `deploys` edges instead of forcing it into `parentId`.
- Use optional `display` hints only when the repository provides a meaningful spatial or visual grouping. Let the viewer lay out nodes otherwise.
- Preserve user-authored descriptions and layout hints when refreshing a map unless new evidence invalidates them.

## Mapping Ambiguity

Continue with a useful best-effort map when evidence is incomplete. Add concise entries to the map's `warnings` array for unresolved ownership, ambiguous deployables, dynamic calls, or missing infrastructure context. Ask the user only when the ambiguity would produce materially different system boundaries and cannot be resolved locally.

## Refreshing an Existing Map

Compare the current repository with `.repo-city/map.json`. Retain IDs, descriptions, and layout hints for unchanged components; add and remove nodes intentionally; update evidence and metrics; then validate the complete map. Do not replace a curated map with a purely mechanical rescan.
