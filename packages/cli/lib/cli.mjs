import { spawn, spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "0.3.0";
const packageRoot = fileURLToPath(new URL("..", import.meta.url));

const HELP = `Functionary CLI ${VERSION}

Usage:
  functionary map [repository] [--output path] [--agent-command path] [--agent-arg value] [--evidence mode] [--verbose]
  functionary prompt [repository] [--prompt-output path] [--evidence mode]
  functionary validate [map-or-repository]
  functionary skill
  functionary --help

Commands:
  map       Ask an AI coding agent to create .functionary/map.json
  prompt    Create a self-contained mapping prompt for any AI coding agent
  validate  Validate an existing Functionary City map
  skill     Print the bundled map-codebase skill path

Agent runners:
  By default, map uses the Codex CLI adapter with read-only repository access.
  --agent-command path         Run any agent command instead
  --agent-arg value            Pass a repeatable argument to that command
  --codex path                 Use a specific Codex executable
  --model model                Select a model for the Codex adapter

  Custom commands receive the prompt on stdin and run from the repository root.
  They should write map JSON to $FUNCTIONARY_OUTPUT or return only JSON on stdout.
  Functionary also provides $FUNCTIONARY_SCHEMA, $FUNCTIONARY_SKILL, and
  $FUNCTIONARY_REPOSITORY, then validates the result independently.

Map evidence:
  --evidence auto               Use Codebase Memory when installed (default)
  --evidence none               Use the mapping agent without a graph analyzer
  --evidence codebase-memory    Require Codebase Memory or stop with a clear error
  --codebase-memory path        Use a specific codebase-memory-mcp executable

Use functionary prompt when an agent cannot be launched as a local command.
The reusable skill, schema, evidence collector, and validator are agent-neutral.`;

function parseArguments(argv) {
  const options = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") options.help = true;
    else if (value === "--version" || value === "-V") options.version = true;
    else if (value === "--verbose") options.verbose = true;
    else if (value === "--agent-arg" || value.startsWith("--agent-arg=")) {
      const next = value.includes("=") ? value.slice(value.indexOf("=") + 1) : argv[index + 1];
      if (!next) throw new Error("--agent-arg requires a value.");
      options["agent-arg"] ??= [];
      options["agent-arg"].push(next);
      if (!value.includes("=")) index += 1;
    } else if (["--output", "--prompt-output", "--model", "--codex", "--agent-command", "--evidence", "--codebase-memory"].includes(value)) {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) throw new Error(`${value} requires a value.`);
      options[value.slice(2)] = next;
      index += 1;
    } else if (value.startsWith("--")) throw new Error(`Unknown option: ${value}`);
    else positionals.push(value);
  }
  return { options, positionals };
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function findResources() {
  const installedSkill = resolve(packageRoot, "dist/skill/map-codebase");
  const sourceSkill = resolve(packageRoot, "../../skills/map-codebase");
  const skillRoot = await exists(sourceSkill) ? sourceSkill : installedSkill;
  const schemaPath = resolve(packageRoot, "schema/city-map-output.schema.json");
  const validatorPath = resolve(skillRoot, "scripts/validate-city-map.mjs");
  if (!(await exists(resolve(skillRoot, "SKILL.md")))) throw new Error("The bundled map-codebase skill is missing. Reinstall Functionary CLI.");
  if (!(await exists(schemaPath))) throw new Error("The bundled output schema is missing. Reinstall Functionary CLI.");
  const evidenceCollectorPath = resolve(skillRoot, "scripts/collect-code-graph-evidence.mjs");
  return { skillRoot, schemaPath, validatorPath, evidenceCollectorPath };
}

function stripNulls(value) {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== null).map(([key, child]) => [key, stripNulls(child)]));
}

function runChild(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, options);
    child.once("error", reject);
    child.once("exit", (code, signal) => resolvePromise({ code: code ?? 1, signal }));
  });
}

function runCodexChild(command, args, verbose) {
  if (verbose) return runChild(command, args, { stdio: ["ignore", "ignore", "inherit"] });
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 64_000) stderr = stderr.slice(-64_000);
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolvePromise({ code: code ?? 1, signal, stderr }));
  });
}

function runAgentChild(command, args, { repository, prompt, output, schemaPath, skillRoot, verbose }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: repository,
      env: {
        ...process.env,
        FUNCTIONARY_OUTPUT: output,
        FUNCTIONARY_REPOSITORY: repository,
        FUNCTIONARY_SCHEMA: schemaPath,
        FUNCTIONARY_SKILL: skillRoot,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => {
      if (verbose) process.stderr.write(chunk);
      else {
        stderr += chunk.toString();
        if (stderr.length > 64_000) stderr = stderr.slice(-64_000);
      }
    });
    child.stdin.on("error", () => {});
    child.once("error", reject);
    child.once("exit", (code, signal) => resolvePromise({ code: code ?? 1, signal, stderr, stdout }));
    child.stdin.end(prompt);
  });
}

function resolveCodebaseMemory(options) {
  const mode = options.evidence ?? "auto";
  if (!["auto", "none", "codebase-memory"].includes(mode)) {
    throw new Error("--evidence must be auto, none, or codebase-memory.");
  }
  if (mode === "none") return null;
  const explicit = options["codebase-memory"] ?? process.env.FUNCTIONARY_CODEBASE_MEMORY;
  const backend = explicit ?? "codebase-memory-mcp";
  const probe = spawnSync(backend, ["--help"], { stdio: "ignore" });
  if (!probe.error || probe.error.code !== "ENOENT") return backend;
  if (mode === "codebase-memory" || explicit) {
    throw new Error("Codebase Memory was not found. Install codebase-memory-mcp, pass --codebase-memory <path>, or use --evidence none.");
  }
  return null;
}

async function collectOptionalEvidence(repository, options, collectorPath, logger = console) {
  const backend = resolveCodebaseMemory(options);
  if (!backend) {
    if ((options.evidence ?? "auto") === "auto") logger.log("Code graph evidence unavailable; continuing with agent analysis.");
    return null;
  }
  if (!(await exists(collectorPath))) throw new Error("The bundled code evidence collector is missing. Reinstall Functionary CLI.");

  const evidenceDirectory = await mkdtemp(join(tmpdir(), "functionary-evidence-"));
  const evidenceOutput = resolve(evidenceDirectory, "evidence.json");
  logger.log("Indexing static code relationships with Codebase Memory…");
  try {
    const result = await runCodexChild(process.execPath, [
      collectorPath,
      repository,
      "--backend", backend,
      "--output", evidenceOutput,
    ], false);
    if (result.code !== 0) {
      const reason = result.stderr?.trim() || `collector exited with code ${result.code}`;
      if ((options.evidence ?? "auto") === "auto" && !options["codebase-memory"]) {
        logger.warn(`Code graph evidence failed; continuing with agent analysis. ${reason}`);
        return null;
      }
      throw new Error(`Codebase Memory evidence collection failed: ${reason}`);
    }
    return JSON.parse(await readFile(evidenceOutput, "utf8"));
  } finally {
    await rm(evidenceDirectory, { recursive: true, force: true });
  }
}

async function resolveMapPath(input = ".") {
  const candidate = resolve(input);
  const info = await stat(candidate).catch(() => null);
  if (!info?.isDirectory()) return candidate;
  const current = resolve(candidate, ".functionary/map.json");
  return await exists(current) ? current : resolve(candidate, ".repo-city/map.json");
}

async function validateMap(path, validatorPath) {
  const result = await runChild(process.execPath, [validatorPath, path], { stdio: "inherit" });
  if (result.code !== 0) throw new Error("Functionary City map validation failed.");
}

async function createMappingContext(repositoryInput, options, logger = console, embedResources = false) {
  const repository = resolve(repositoryInput ?? ".");
  const info = await stat(repository).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`Repository not found: ${repository}`);

  const { skillRoot, schemaPath, validatorPath, evidenceCollectorPath } = await findResources();
  const output = resolve(options.output ?? resolve(repository, ".functionary/map.json"));
  const legacyOutput = resolve(repository, ".repo-city/map.json");
  const evidence = await collectOptionalEvidence(repository, options, evidenceCollectorPath, logger);
  const evidenceInstructions = evidence ? `

Before broad source inspection, use the following Functionary code-graph evidence bundle to prioritize files and relationships. ${embedResources ? "Follow the embedded code-graph evidence guidance before interpreting it." : `Read ${skillRoot}/references/code-graph-evidence.md before interpreting it.`} This is derived static evidence, not runtime truth: verify every architectural claim against repository source or configuration, keep source paths repository-relative, and do not turn every symbol into a city node.

<functionary-code-graph-evidence>
${JSON.stringify(evidence)}
</functionary-code-graph-evidence>` : "";

  let embeddedInstructions = "";
  if (embedResources) {
    const [skill, schemaReference, evidenceReference, outputSchema] = await Promise.all([
      readFile(resolve(skillRoot, "SKILL.md"), "utf8"),
      readFile(resolve(skillRoot, "references/city-map-schema.md"), "utf8"),
      readFile(resolve(skillRoot, "references/code-graph-evidence.md"), "utf8"),
      readFile(schemaPath, "utf8"),
    ]);
    embeddedInstructions = `

The complete Functionary mapping contract is embedded below so this prompt can
be used by an agent that cannot access the installed CLI files.

<functionary-map-codebase-skill>
${skill}
</functionary-map-codebase-skill>

<functionary-city-map-reference>
${schemaReference}
</functionary-city-map-reference>

<functionary-code-graph-guidance>
${evidenceReference}
</functionary-code-graph-guidance>

<functionary-output-schema>
${outputSchema}
</functionary-output-schema>`;
  }

  const prompt = `${embedResources ? "Use the embedded agent-neutral map-codebase skill" : `Use the agent-neutral map-codebase skill at ${skillRoot}`} to inspect this repository and create a Functionary City map.

${embedResources ? "Follow the embedded skill and every embedded reference." : "Read SKILL.md and every reference it requires."} Follow repository-local instructions. Prefer architectural meaning over directory mirroring. Include source and infrastructure components when the repository contains them. Model the system from its public or operator-facing boundary through orchestration, core compute, runtime, data, and external systems; do not assume the repository is a web or React application. Every building must open into at least two meaningful rooms, but the evidence—not a repeated visual convention—must determine the final room count; use a leaf archetype when there is no useful interior. Keep source paths repository-relative and record a canonical GitHub repository or stable source URLs so the viewer can link the evidence. Use declared, observed, and inferred evidence honestly. Preserve stable IDs and curated details from an existing ${output} or legacy ${legacyOutput} when present.${evidenceInstructions}${embeddedInstructions}

For this non-interactive run, do not modify repository files. Return only the complete Functionary City JSON object as the final response; Functionary captures and validates it. Do not wrap the JSON in Markdown.`;

  return { repository, output, prompt, skillRoot, schemaPath, validatorPath };
}

async function promptRepository(repositoryInput, options) {
  const logger = { log: console.error, warn: console.warn };
  const { prompt } = await createMappingContext(repositoryInput, options, logger, true);
  if (!options["prompt-output"]) {
    console.log(prompt);
    return;
  }
  const promptOutput = resolve(options["prompt-output"]);
  await mkdir(dirname(promptOutput), { recursive: true });
  await writeFile(promptOutput, `${prompt}\n`, "utf8");
  console.log(`Agent prompt ready: ${promptOutput}`);
}

async function mapRepository(repositoryInput, options) {
  const usePortableRunner = Boolean(options["agent-command"]);
  const { repository, output, prompt, skillRoot, schemaPath, validatorPath } = await createMappingContext(repositoryInput, options, console, usePortableRunner);
  const temporaryOutput = resolve(dirname(output), ".map.generated.json");
  await mkdir(dirname(output), { recursive: true });
  await rm(temporaryOutput, { force: true });

  const agentCommand = options["agent-command"] ?? null;
  const agentArguments = options["agent-arg"] ?? [];

  const codex = options.codex ?? process.env.FUNCTIONARY_CODEX ?? process.env.REPO_CITY_CODEX ?? "codex";
  const args = [
    "exec",
    "--ephemeral",
    "--sandbox", "read-only",
    "--cd", repository,
    "--color", "never",
    "--output-schema", schemaPath,
    "--output-last-message", temporaryOutput,
  ];
  if (options.model) args.push("--model", options.model);
  const gitCheck = spawnSync("git", ["-C", repository, "rev-parse", "--is-inside-work-tree"], { stdio: "ignore" });
  if (gitCheck.status !== 0) args.push("--skip-git-repo-check");
  args.push(prompt);

  console.log(`Mapping ${repository}`);
  if (agentCommand) {
    console.log(`Agent runner: ${agentCommand}`);
    console.log("The runner controls repository permissions; Functionary validates and writes only the captured map.");
  } else {
    console.log("Codex adapter: read-only repository access; Functionary captures the final map.");
  }
  console.log(options.verbose ? "Verbose agent output enabled." : "Inspecting architecture; use --verbose to show agent activity.");
  const startedAt = Date.now();
  const progressTimer = options.verbose ? null : setInterval(() => {
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    console.log(`Still mapping… ${elapsedMinutes}m elapsed`);
  }, 30_000);
  progressTimer?.unref();

  let result;
  try {
    result = agentCommand
      ? await runAgentChild(agentCommand, agentArguments, { repository, prompt, output: temporaryOutput, schemaPath, skillRoot, verbose: options.verbose })
      : await runCodexChild(codex, args, options.verbose);
  } catch (error) {
    if (error?.code === "ENOENT" && agentCommand) throw new Error(`Agent command was not found: ${agentCommand}`);
    if (error?.code === "ENOENT") throw new Error("Codex CLI was not found. Install and authenticate Codex, pass --codex <path>, use --agent-command, or run functionary prompt.");
    throw error;
  } finally {
    if (progressTimer) clearInterval(progressTimer);
  }
  if (result.code !== 0) {
    await rm(temporaryOutput, { force: true });
    if (result.stderr?.trim()) console.error(result.stderr.trim());
    throw new Error(`${agentCommand ? "Agent" : "Codex"} mapping failed with exit code ${result.code}.`);
  }

  try {
    if (!(await exists(temporaryOutput)) && agentCommand && result.stdout?.trim()) {
      await writeFile(temporaryOutput, result.stdout.trim(), "utf8");
    }
    if (!(await exists(temporaryOutput))) {
      throw new Error("The agent returned no map. Write JSON to $FUNCTIONARY_OUTPUT or return only JSON on stdout.");
    }
    const parsed = JSON.parse(await readFile(temporaryOutput, "utf8"));
    const normalized = stripNulls(parsed);
    await writeFile(temporaryOutput, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    await validateMap(temporaryOutput, validatorPath);
    await rename(temporaryOutput, output);
    console.log(`Map ready: ${output}`);
    console.log(`${normalized.nodes.length} nodes · ${normalized.edges.length} relationships`);
  } catch (error) {
    await rm(temporaryOutput, { force: true });
    throw error;
  }
}

export async function run(argv) {
  const { options, positionals } = parseArguments(argv);
  if (options.version) { console.log(VERSION); return; }
  const command = positionals.shift() ?? "help";
  if (options.help || command === "help") { console.log(HELP); return; }

  const resources = await findResources();
  if (command === "skill") { console.log(resources.skillRoot); return; }
  if (command === "prompt") {
    await promptRepository(positionals[0], options);
    return;
  }
  if (command === "validate") {
    const mapPath = await resolveMapPath(positionals[0]);
    await validateMap(mapPath, resources.validatorPath);
    return;
  }
  if (command === "map") {
    await mapRepository(positionals[0], options);
    return;
  }
  throw new Error(`Unknown command: ${command}\n\n${HELP}`);
}
