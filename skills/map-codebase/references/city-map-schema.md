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
| `repository` | no | string | Repository name or canonical location |
| `summary` | no | string | One-sentence system description |
| `generatedAt` | no | ISO-8601 string | Scan time |
| `nodes` | yes | array | Architectural entities |
| `edges` | yes | array | Relationships between entities |
| `warnings` | no | string array | Important mapping uncertainty |

## Nodes

Each node requires `id`, `label`, `kind`, and `archetype`.

Valid `kind` values:

- `scope`: domain or district; use `archetype: "district"`.
- `deployable`: executable software unit; normally use `building` or `worker`.
- `module`: meaningful interior component; normally use `room`.
- `infra`: infrastructure resource; use the closest infrastructure archetype.
- `external`: externally owned system; normally use `cloud`.

Valid `archetype` values:

`district`, `building`, `room`, `gateway`, `worker`, `database`, `queue`, `storage`, `cloud`.

Optional node fields:

- `parentId`: containment parent. Campus structures normally point to a scope; rooms point to a deployable.
- `description`: concise functional responsibility.
- `sourceRefs`: evidence locations with `path`, optional `line`, optional `url`, and optional `note`.
- `metrics`: numeric measurements such as `loc`, `churn`, `tables`, `routes`, or `rooms`.
- `tags`: short classification strings.
- `display.position`: optional `[x, z]` coordinates.
- `display.size`: optional `[width, height, depth]` dimensions. Keep each value positive.
- `display.color`: optional CSS hex color.
- `display.flowLayer`: optional non-negative integer. `0` is the repository's public or operator-facing boundary; larger values move downstream through orchestration, core compute, runtime, state, and external systems.
- `display.flowOrder`: optional non-negative number used to stabilize left-to-right order inside a flow layer.

Use lowercase kebab-case stable IDs. Do not encode absolute filesystem paths or commit hashes into IDs.

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
      "sourceRefs": [{ "path": "services/inventory/package.json" }]
    },
    {
      "id": "inventory-db",
      "label": "Inventory DB",
      "kind": "infra",
      "archetype": "database",
      "parentId": "inventory-domain",
      "sourceRefs": [{ "path": "infra/inventory.tf", "line": 12 }]
    }
  ],
  "edges": [
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
