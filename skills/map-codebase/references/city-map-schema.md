# Functionary City map schema

## Contents

- Output location
- Root object
- Nodes
- Edges
- Evidence and confidence
- Visual defaults
- Minimal example

## Output location

Write UTF-8 JSON to `.functionary/map.json` at the repository root. Use two-space indentation and end the file with a newline. Treat `.repo-city/map.json` as a legacy input when refreshing an existing map.

## Root object

| Field | Required | Type | Meaning |
|---|---:|---|---|
| `schemaVersion` | yes | `1` | Schema compatibility version |
| `id` | yes | string | Stable repository or system ID |
| `name` | yes | string | Human-facing map title |
| `repository` | no | string | Repository name or canonical location; use `github.com/owner/repository` for GitHub so source paths become links |
| `summary` | no | string | One-sentence system description |
| `generatedAt` | no | ISO-8601 string | Scan time |
| `nodes` | yes | array | Architectural entities |
| `edges` | yes | array | Relationships between entities |
| `warnings` | no | string array | Important mapping uncertainty |

## Nodes

Each node requires `id`, `label`, `kind`, and `archetype`.

Valid `kind` values:

- `scope`: a visible city neighborhood representing a domain, bounded context, major product, or ownership area; use `archetype: "district"`.
- `deployable`: executable software unit; use `building` only when a useful interior can be mapped, otherwise use a leaf archetype such as `gateway` or `worker`.
- `module`: meaningful interior component; normally use `room`.
- `infra`: infrastructure resource; use the closest infrastructure archetype.
- `external`: externally owned system; normally use `cloud`.

Valid `archetype` values:

`district`, `building`, `room`, `gateway`, `worker`, `database`, `queue`, `storage`, `cloud`.

`building` means “openable system,” not merely “important component.” Every building must have at least two direct children with `archetype: "room"`. The count above that minimum must follow distinct, evidence-backed responsibilities; do not normalize interiors to a repeated number such as three. A node without meaningful rooms must use the closest leaf archetype. Never invent rooms to satisfy the rule.

Optional node fields:

- `parentId`: containment parent. Campus structures normally point to a scope; rooms point to a deployable.
- `description`: concise functional responsibility.
- `sourceRefs`: evidence locations with repository-relative `path`, optional `line`, optional `url`, and optional `note`. The viewer resolves GitHub paths against the repository's default branch. For other hosts, include a stable `url` when available.
- `metrics`: numeric measurements such as `loc`, `churn`, `tables`, `routes`, or `rooms`.
- `tags`: short classification strings.
- `display.position`: optional `[x, z]` coordinates.
- `display.size`: optional `[width, height, depth]` dimensions. Keep each value positive.
- `display.color`: optional CSS hex color.
- `display.flowLayer`: optional non-negative integer. `0` is the repository's public or operator-facing boundary; larger values move downstream through orchestration, core compute, runtime, state, and external systems.
- `display.flowOrder`: optional non-negative number used to stabilize left-to-right order inside a flow layer.

Use lowercase kebab-case stable IDs. Do not encode absolute filesystem paths or commit hashes into IDs.

Campus structures must be direct children of scopes. For substantial repositories, prefer 2–6 semantic neighborhoods rather than one catch-all district or a district per component. Group by responsibility or ownership, not by node kind: code, infrastructure, and relevant external systems may share a neighborhood when they serve the same domain.

## Edges

Each edge requires:

- `id`: stable unique ID.
- `from` and `to`: existing node IDs.
- `kind`: `depends_on`, `calls`, `data_flow`, or `deploys`.
- `evidence`: `declared`, `observed`, or `inferred`.

Optional edge fields:

- `confidence`: number between `0` and `1`; include it for inferred relationships.
- `label`: short protocol, topic, action, or relationship name.
- `weight`: normalized traffic, importance, or frequency measurement.
- `sourceRefs`: evidence locations.

Orient calls and data flow from initiator or producer to receiver or consumer. Orient `depends_on` from dependent to dependency. Orient `deploys` from software unit to deployment resource.

For inbound webhooks, callbacks, and subscribed events, orient `data_flow` from the external producer to the repository's receiving gateway or room. For outbound webhook delivery, orient it from the repository producer to the external receiver. Create external nodes only for verified, architecturally meaningful integrations; aggregate interchangeable vendors instead of creating a cloud for every SDK.

## Evidence and confidence

Do not use `observed` without runtime evidence. Use `declared` for compiler-resolved imports, explicit configuration, IaC references, and manifests. Use `inferred` for naming conventions, partial static analysis, architecture prose, or agent interpretation.

Suggested inferred confidence:

- `0.90–0.99`: strong corroborating evidence.
- `0.70–0.89`: likely relationship with one meaningful ambiguity.
- `0.50–0.69`: plausible but weak; add a warning when architecturally important.
- Below `0.50`: omit unless the uncertainty itself is useful.

## Flow and visual defaults

Every useful map should describe front-to-back flow. Choose the correct boundary for the repository rather than assuming a browser user:

- app or service: request, event, UI, gateway, or scheduled trigger;
- library or framework: public exports and supported APIs;
- CLI: command parser and dispatch;
- compiler or build tool: source input through emission;
- data or ML system: ingestion through transform, model, serving, or sink;
- infrastructure/controller: operator input through reconciliation to managed resources.

Assign `flowLayer: 0` to that boundary and increase the layer downstream. Branching dependencies share a layer and fan outward with `flowOrder`. Cycles may share a layer when forcing an order would misrepresent the system. The viewer can infer missing layers from edge direction and node meaning, but agent-authored layers are preferred when supported by evidence.

The viewer lays scopes out as separated neighborhoods and keeps flow layers aligned across them. Choose scopes before fine-tuning `flowOrder`; neighborhood membership provides the primary horizontal grouping, while `flowLayer` preserves front-to-back movement inside and across neighborhoods.

When providing other display hints:

- Scale footprint roughly with code or resource size.
- Scale height with internal depth or another documented metric.
- Use consistent colors for scopes or ownership, not for unrelated measurements.
- Keep child-room coordinates local to their building interior.

## Minimal example

```json
{
  "schemaVersion": 1,
  "id": "inventory-system",
  "name": "Inventory system",
  "nodes": [
    {
      "id": "inventory-domain",
      "label": "Inventory",
      "kind": "scope",
      "archetype": "district"
    },
    {
      "id": "inventory-api",
      "label": "Inventory API",
      "kind": "deployable",
      "archetype": "building",
      "parentId": "inventory-domain",
      "sourceRefs": [{ "path": "services/inventory/package.json" }],
      "display": { "flowLayer": 0 }
    },
    {
      "id": "inventory-http",
      "label": "HTTP boundary",
      "kind": "module",
      "archetype": "room",
      "parentId": "inventory-api",
      "sourceRefs": [{ "path": "services/inventory/routes.ts" }],
      "display": { "flowLayer": 0 }
    },
    {
      "id": "inventory-service",
      "label": "Inventory operations",
      "kind": "module",
      "archetype": "room",
      "parentId": "inventory-api",
      "sourceRefs": [{ "path": "services/inventory/service.ts" }],
      "display": { "flowLayer": 1 }
    },
    {
      "id": "inventory-db",
      "label": "Inventory DB",
      "kind": "infra",
      "archetype": "database",
      "parentId": "inventory-domain",
      "sourceRefs": [{ "path": "infra/inventory.tf", "line": 12 }],
      "display": { "flowLayer": 1 }
    }
  ],
  "edges": [
    {
      "id": "inventory-http-service",
      "from": "inventory-http",
      "to": "inventory-service",
      "kind": "calls",
      "evidence": "declared"
    },
    {
      "id": "inventory-api-db",
      "from": "inventory-api",
      "to": "inventory-db",
      "kind": "depends_on",
      "evidence": "declared"
    }
  ]
}
```
