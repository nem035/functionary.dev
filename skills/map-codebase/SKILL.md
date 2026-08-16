---
name: map-codebase
description: Inspect any software repository and translate its meaningful architecture and end-to-end flow into a validated Functionary City JSON map. Use when Codex needs to visualize, explain, or map an application, library, CLI, infrastructure project, compiler, data system, monorepo, or other codebase as districts, buildings, rooms, infrastructure, external systems, and evidence-backed relationships; when creating or refreshing `.functionary/map.json`; or when preparing data for the Functionary viewer.
---

# Map Codebase

Interpret the repository as an architecture and flow graph, not as a directory tree. Produce `.functionary/map.json` using the Functionary City schema.

## Workflow

1. Establish the repository root and inspect local agent instructions before acting.
2. Inventory the repository with targeted reads:
   - When the prompt includes a `functionary-code-graph-evidence` bundle, read [references/code-graph-evidence.md](references/code-graph-evidence.md), use the bundle to choose high-value files and relationships, and verify its architectural implications in source.
   - List files with `rg --files`, excluding generated, vendored, cache, and dependency directories.
   - Read architecture documentation, workspace manifests, build definitions, container files, CI workflows, and infrastructure configuration.
   - Inspect representative entry points and dependency declarations before reading implementation broadly.
   - Inspect the Git remote when available. Record GitHub repositories as `github.com/owner/repository` so the viewer can link source paths.
3. Infer the repository's natural architectural units:
   - Use `scope` nodes as visible neighborhoods for domains, bounded contexts, major products, or ownership areas. For a substantial repository, prefer 2–6 meaningful scopes: enough to separate responsibilities without creating a district per component. Avoid a single catch-all scope when the evidence supports multiple cohesive areas.
   - Make every campus-level structure a direct child of exactly one scope. Group by semantic responsibility or ownership, not by technical type or flow layer; a neighborhood may contain code, infrastructure, and the external systems that serve the same domain.
   - Use `deployable` nodes for independently built or executed applications, services, workers, CLIs, and jobs.
   - Use `module` nodes only for meaningful internal boundaries inside a deployable.
   - Use `infra` nodes for databases, queues, storage, gateways, clusters, and other operational resources.
   - Use `external` nodes for systems outside the repository's ownership boundary.
   - Use `archetype: building` only when the node has a useful interior. Give every building at least two direct `room` children that explain how work moves through it. Let the evidence determine the room count; never normalize buildings to a repeated count such as three. If the evidence does not support an interior, use the closest leaf archetype instead.
4. Trace important relationships from manifests, imports, configuration, infrastructure references, and runtime evidence when available. Inspect webhook handlers, OAuth callbacks, subscriptions, and event-consumer routes explicitly. Represent a verified external producer as an `external` node with a directed edge into the receiving gateway or room; orient outbound webhooks from the repository toward the external receiver. Aggregate vendors only when they play the same architectural role.
5. Identify the repository's interaction boundary and order the system front to back:
   - Applications: user, client, request, event, or scheduled entry points.
   - Libraries and frameworks: public exports or supported APIs.
   - CLIs: command parsing, stdin, config, and subcommand dispatch.
   - Data and ML systems: sources and ingestion through transforms, models, sinks, and serving.
   - Infrastructure and controllers: operator inputs and desired state through reconciliation into managed resources.
   - Compilers and build tools: source input through parsing, analysis, transformation, emission, and runtime consumers.
   - Documentation or content systems: authored source through processing and delivery.
   Assign `display.flowLayer` starting at `0` and increasing downstream. Use `display.flowOrder` only to stabilize useful left-to-right grouping within a layer.
   For every building, repeat this flow analysis inside the building and assign local flow layers to its rooms.
6. Assign evidence honestly:
   - Mark explicit configuration or resolved references as `declared`.
   - Mark telemetry, traces, logs, or other runtime facts as `observed`.
   - Mark architectural conclusions or unresolved static references as `inferred`, with a calibrated confidence value.
7. Read [references/city-map-schema.md](references/city-map-schema.md) completely before writing the map.
8. Create or update `.functionary/map.json`. When refreshing, also check for a legacy `.repo-city/map.json`; preserve stable IDs whenever the underlying component is the same.
9. Validate the result:

   ```bash
   node <skill-directory>/scripts/validate-city-map.mjs .functionary/map.json
   ```

10. Repair validation failures. Report the output path, map counts, warnings, and important uncertain interpretations.

## Interpretation Rules

- Prefer architectural meaning over folder depth.
- Make substantial systems with meaningful internal flow the campus-level buildings.
- Make packages, subsystems, or cohesive source areas the rooms inside a building.
- A building is a navigation promise. Never emit an empty building or invent rooms to make one look substantial. Reclassify a leaf as `gateway`, `worker`, `database`, `queue`, `storage`, `cloud`, or `room` according to its responsibility.
- Give every building at least two direct children with `archetype: room`, concise descriptions, source references, and evidence-backed relationships when the rooms interact.
- Vary room counts only when responsibilities vary. Do not pad a building to a target number or merge distinct responsibilities merely to make interiors visually uniform.
- Collapse repetitive files, tests, generated code, fixtures, migrations, and third-party dependencies unless they are architecturally significant.
- Keep campus maps readable. Prefer 5–40 top-level structures and drill-down interiors over hundreds of buildings.
- Treat scopes as the city neighborhoods. Give neighborhoods distinct, concise names and distribute campus structures among them so no dense catch-all district dominates the map.
- Attach `sourceRefs` to every significant node and inferred edge when evidence is available.
- Keep every source `path` repository-relative. When the repository is not on GitHub, add a stable `url` to each source reference when one is available.
- Never claim runtime behavior from static code alone.
- Treat analyzer output as a search index, not as the architecture. Promote only cohesive, user-meaningful systems; never mirror symbol, file, or package counts into city nodes.
- Keep organizational containment and deployment relationships separate. Represent deployment with `deploys` edges instead of forcing it into `parentId`.
- Orient calls and data flow from initiator or producer to receiver or consumer. Orient `depends_on` from dependent to dependency so the viewer can derive system flow.
- Assign flow layers by semantic stage, not framework conventions. Do not assume a web frontend exists or force every repository into a user-interface model.
- Place branching dependencies in the same downstream layer and use `flowOrder` to fan them left to right. Keep entry points sparse and downstream layers free to expand.
- Use `display.position` only for a genuinely curated spatial override. Prefer `flowLayer` and `flowOrder` for normal maps.
- Preserve user-authored descriptions and layout hints when refreshing a map unless new evidence invalidates them.

## Mapping Ambiguity

Continue with a useful best-effort map when evidence is incomplete. Add concise entries to the map's `warnings` array for unresolved ownership, ambiguous deployables, dynamic calls, or missing infrastructure context. Ask the user only when the ambiguity would produce materially different system boundaries and cannot be resolved locally.

## Refreshing an Existing Map

Compare the current repository with `.functionary/map.json` or the legacy `.repo-city/map.json`. Retain IDs, descriptions, and layout hints for unchanged components; add and remove nodes intentionally; update evidence and metrics; then validate the complete map. Do not replace a curated map with a purely mechanical rescan.
