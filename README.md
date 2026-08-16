# Functionary

Functionary turns an unfamiliar repository into an explorable, source-linked
system city. Entry points sit at the front, calls and data flow move through the
middle, and infrastructure plus external systems expand behind them.

It is repository-agnostic: the bundled mapping skill recognizes applications,
libraries, CLIs, compilers, infrastructure controllers, data and ML pipelines,
documentation systems, monorepos, and other software shapes.

## Map a repository

Prerequisites: Node.js 20 or newer and an installed, authenticated Codex CLI.

```bash
cd packages/cli
npm pack
npm install -g ./functionary-cli-0.2.0.tgz

functionary map ~/Dev/my-project
```

The command creates `~/Dev/my-project/.functionary/map.json`. Codex receives
read-only repository access; the CLI writes only the captured map. The package
contains the mapping skill, structured-output schema, and deterministic
validator.

Functionary can optionally use [Codebase Memory](https://github.com/DeusData/codebase-memory-mcp)
as a fast structural index. When `codebase-memory-mcp` is installed, the CLI
automatically gives its compact call/import/package evidence to the mapping
agent, which still verifies architectural claims in the repository. The index
uses a temporary cache and is never rendered directly as the city.

Useful commands:

```bash
functionary validate ~/Dev/my-project
functionary skill
functionary map ~/Dev/my-project --output /tmp/my-project-map.json
functionary map ~/Dev/my-project --verbose
functionary map ~/Dev/my-project --evidence none
functionary map ~/Dev/my-project --evidence codebase-memory
functionary map ~/Dev/my-project --codebase-memory /path/to/codebase-memory-mcp
```

`--evidence auto` is the default and falls back cleanly to agent-only mapping.
Use `--evidence codebase-memory` when a missing or failed analyzer should stop
the run instead.

The legacy `repo-city` command remains as an alias, and validation still finds
existing `.repo-city/map.json` files.

## Open the atlas

```bash
npm install
npm run dev
```

Open `http://localhost:3000` to explore the curated React, Kubernetes, and Redis
maps. Choose **Open map** to load a generated `.functionary/map.json` file.

## Map model

Nodes form the spatial hierarchy; typed edges describe dependencies, calls,
data flow, and deployment. `display.flowLayer` describes semantic distance from
the repository's interaction boundary, while `display.flowOrder` controls
lateral fan-out. The viewer can infer both for legacy maps.

The reusable agent workflow lives in [`skills/map-codebase`](./skills/map-codebase),
and the installable package lives in [`packages/cli`](./packages/cli).

## Development

```bash
npm run build
npm test
cd packages/cli && npm test
```
