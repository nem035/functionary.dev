import { spawn, spawnSync } from "node:child_process";
import { access, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "0.2.0";
const packageRoot = fileURLToPath(new URL("..", import.meta.url));

const HELP = `Functionary CLI ${VERSION}

Usage:
  functionary map [repository] [--output path] [--model model] [--codex path] [--evidence mode] [--codebase-memory path] [--verbose]
  functionary validate [map-or-repository]
  functionary skill
  functionary --help

Commands:
  map       Ask Codex to inspect a repository and create .functionary/map.json
  validate  Validate an existing Functionary City map
  skill     Print the bundled map-codebase skill path

Map evidence:
  --evidence auto               Use Codebase Memory when installed (default)
  --evidence none               Use the mapping agent without a graph analyzer
  --evidence codebase-memory    Require Codebase Memory or stop with a clear error
  --codebase-memory path        Use a specific codebase-memory-mcp executable

The map command uses your existing Codex CLI authentication. It gives the
mapping agent read-only repository access and writes only the captured map.`;

function parseArguments(argv) {
  const options = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") options.help = true;
    else if (value === "--version" || value === "-V") options.version = true;
    else if (value === "--verbose") options.verbose = true;
    else if (["--output", "--model", "--codex", "--evidence", "--codebase-memory"].includes(value)) {
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

async function collectOptionalEvidence(repository, output, options, collectorPath) {
  const backend = resolveCodebaseMemory(options);
  if (!backend) {
    if ((options.evidence ?? "auto") === "auto") console.log("Code graph evidence unavailable; continuing with agent analysis.");
    return null;
  }
  if (!(await exists(collectorPath))) throw new Error("The bundled code evidence collector is missing. Reinstall Functionary CLI.");

  const evidenceOutput = resolve(dirname(output), ".code-evidence.generated.json");
  await rm(evidenceOutput, { force: true });
  console.log("Indexing static code relationships with Codebase Memory…");
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
        console.warn(`Code graph evidence failed; continuing with agent analysis. ${reason}`);
        return null;
      }
      throw new Error(`Codebase Memory evidence collection failed: ${reason}`);
    }
    return JSON.parse(await readFile(evidenceOutput, "utf8"));
  } finally {
    await rm(evidenceOutput, { force: true });
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

async function mapRepository(repositoryInput, options) {
  const repository = resolve(repositoryInput ?? ".");
  const info = await stat(repository).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`Repository not found: ${repository}`);

  const { skillRoot, schemaPath, validatorPath, evidenceCollectorPath } = await findResources();
  const output = resolve(options.output ?? resolve(repository, ".functionary/map.json"));
  const legacyOutput = resolve(repository, ".repo-city/map.json");
  const temporaryOutput = resolve(dirname(output), ".map.generated.json");
  await mkdir(dirname(output), { recursive: true });
  await rm(temporaryOutput, { force: true });

  const evidence = await collectOptionalEvidence(repository, output, options, evidenceCollectorPath);
  const evidenceInstructions = evidence ? `

Before broad source inspection, use the following Functionary code-graph evidence bundle to prioritize files and relationships. Read ${skillRoot}/references/code-graph-evidence.md before interpreting it. This is derived static evidence, not runtime truth: verify every architectural claim against repository source or configuration, keep source paths repository-relative, and do not turn every symbol into a city node.

<functionary-code-graph-evidence>
${JSON.stringify(evidence)}
</functionary-code-graph-evidence>` : "";

  const prompt = `Use the map-codebase skill at ${skillRoot} to inspect this repository and create a Functionary City map.

Read SKILL.md and every reference it requires. Follow repository-local instructions. Prefer architectural meaning over directory mirroring. Include source and infrastructure components when the repository contains them. Model the system from its public or operator-facing boundary through orchestration, core compute, runtime, data, and external systems; do not assume the repository is a web or React application. Every building must open into at least two meaningful rooms, but the evidence—not a repeated visual convention—must determine the final room count; use a leaf archetype when there is no useful interior. Keep source paths repository-relative and record a canonical GitHub repository or stable source URLs so the viewer can link the evidence. Use declared, observed, and inferred evidence honestly. Preserve stable IDs and curated details from an existing ${output} or legacy ${legacyOutput} when present.${evidenceInstructions}

For this non-interactive run, do not modify repository files. Return only the complete Functionary City JSON object as the final response; the CLI captures and validates it. Do not wrap the JSON in Markdown.`;

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
  console.log("Codex has read-only repository access; Functionary captures the final map.");
  console.log(options.verbose ? "Verbose Codex output enabled." : "Inspecting architecture; use --verbose to show Codex activity.");
  const startedAt = Date.now();
  const progressTimer = options.verbose ? null : setInterval(() => {
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    console.log(`Still mapping… ${elapsedMinutes}m elapsed`);
  }, 30_000);
  progressTimer?.unref();

  let result;
  try {
    result = await runCodexChild(codex, args, options.verbose);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error("Codex CLI was not found. Install and authenticate Codex, or pass --codex <path>.");
    throw error;
  } finally {
    if (progressTimer) clearInterval(progressTimer);
  }
  if (result.code !== 0) {
    await rm(temporaryOutput, { force: true });
    if (result.stderr?.trim()) console.error(result.stderr.trim());
    throw new Error(`Codex mapping failed with exit code ${result.code}.`);
  }

  try {
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
