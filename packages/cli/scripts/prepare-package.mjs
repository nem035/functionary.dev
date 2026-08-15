import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, "..");
const source = resolve(packageRoot, "../../skills/map-codebase");
const destination = resolve(packageRoot, "dist/skill/map-codebase");

await rm(resolve(packageRoot, "dist"), { recursive: true, force: true });
await mkdir(dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true });
console.log("Bundled map-codebase skill.");
