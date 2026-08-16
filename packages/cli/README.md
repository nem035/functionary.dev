# Functionary CLI

Functionary turns a repository into a validated, source-linked system city.
Its mapping skill, schema, evidence collector, and validator are agent-neutral.

## Map with the built-in Codex adapter

```bash
functionary map /path/to/repository
```

## Map with any local AI agent

```bash
functionary map . --agent-command my-agent-wrapper
functionary map . --agent-command my-agent-wrapper --agent-arg=--json
```

Functionary starts the command in the repository root and sends a
self-contained mapping prompt on stdin. The command should either write the
complete JSON map to `$FUNCTIONARY_OUTPUT` or return only the JSON object on
stdout. These additional paths are available to adapters:

- `$FUNCTIONARY_REPOSITORY`
- `$FUNCTIONARY_SCHEMA`
- `$FUNCTIONARY_SKILL`

Functionary validates the result and only then moves it to
`.functionary/map.json`. Repository permissions and sandboxing are controlled
by the selected agent runner.

## Map with an agent that cannot be launched locally

```bash
functionary prompt . --prompt-output functionary-prompt.md
functionary validate .functionary/map.json
```

The generated prompt embeds the full mapping skill and output schema, so it can
be handed to any agent with access to the repository.
