import { cp, lstat, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const runtimeFiles = ["package.json", "package-lock.json", "host.json", "dist/index.cjs"];

export async function verifyApiPackage(directory) {
  const root = resolve(directory);
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  if (pkg.main !== "dist/index.cjs" || !pkg.dependencies?.["@azure/functions"] || !pkg.dependencies?.["@azure/data-tables"]) {
    throw new Error("Invalid API runtime package.");
  }
  for (const file of runtimeFiles) if (!(await stat(join(root, file))).isFile()) throw new Error("Missing API runtime file.");
  for (const name of await readdir(root)) {
    if (!["package.json", "package-lock.json", "host.json", "dist", "node_modules"].includes(name)) throw new Error("Unexpected API artifact content.");
  }
  if (JSON.stringify(await readdir(join(root, "dist"))) !== '["index.cjs"]') throw new Error("Unexpected API build content.");
  const require = createRequire(join(root, "package.json"));
  for (const dependency of ["@azure/functions", "@azure/data-tables"]) {
    const located = require.resolve(dependency);
    const inside = relative(join(root, "node_modules"), located);
    if (inside.startsWith("..") || isAbsolute(inside)) throw new Error("Runtime dependency resolved outside the artifact.");
  }
  for (const name of ["azurite", "vitest", "esbuild", "typescript"]) {
    if (existsSync(join(root, "node_modules", name))) throw new Error("Development dependency in API artifact.");
  }
}

function installProduction(directory) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli || !existsSync(npmCli)) throw new Error("Run staging with npm run stage:api.");
  const result = spawnSync(process.execPath, [npmCli, "ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: directory, stdio: "pipe", encoding: "utf8", windowsHide: true,
  });
  if (result.error || result.status !== 0) throw new Error("API production dependency installation failed.");
}

export async function stageApi({ sourceDirectory, outputDirectory, install = installProduction }) {
  const source = resolve(sourceDirectory), output = resolve(outputDirectory);
  const within = (parent, child) => { const path = relative(parent, child); return path === "" ||
    (!isAbsolute(path) && path !== ".." && !path.startsWith(".." + sep)); };
  if (within(source, output) || within(output, source)) {
    throw new Error("API source and artifact directories must be disjoint.");
  }
  await mkdir(output, { recursive: true });
  const existing = await readdir(output);
  if (existing.some((name) => !["package.json", "package-lock.json", "host.json", "dist", "node_modules"].includes(name))) {
    throw new Error("Refusing to overwrite an unrelated artifact directory.");
  }
  for (const file of runtimeFiles) {
    await mkdir(dirname(join(output, file)), { recursive: true });
    await cp(join(source, file), join(output, file));
  }
  await install(output);
  await verifyApiPackage(output);
}

export async function verifyFrontendArtifact(directory, requireConfig = false) {
  for (const name of await readdir(directory)) {
    if (!["index.html", "assets", "audio", ...(requireConfig ? ["staticwebapp.config.json"] : [])].includes(name)) {
      throw new Error("Unexpected frontend artifact content.");
    }
  }
  await readFile(join(directory, "index.html"));
  if (requireConfig) await readFile(join(directory, "staticwebapp.config.json"));
  for (const name of ["assets", "audio"]) {
    if (!(await stat(join(directory, name))).isDirectory()) throw new Error("Missing frontend assets.");
  }
  for (const name of await readdir(join(directory, "assets"))) {
    if (!/^[A-Za-z0-9_-]+\.(?:js|css)$/.test(name) || !(await lstat(join(directory, "assets", name))).isFile()) {
      throw new Error("Unexpected frontend build asset.");
    }
  }
  const audioFiles = ["LICENSES.md", "fall-thud.mp3", "stair-climb-bgm.mp3", "stone-step.ogg"];
  const audio = await readdir(join(directory, "audio"));
  if (audio.length !== audioFiles.length || audio.some((name) => !audioFiles.includes(name))) throw new Error("Unexpected audio artifact.");
  for (const name of audio) if (!(await lstat(join(directory, "audio", name))).isFile()) throw new Error("Invalid audio artifact.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await stageApi({ sourceDirectory: "api", outputDirectory: "release/api" });
    await verifyFrontendArtifact("dist");
    await writeFile("release/build-manifest.json", JSON.stringify({ schemaVersion: 1,
      sourceSha: process.env.GITHUB_SHA ?? "local", frontend: "dist", api: "release/api" }, null, 2) + "\n");
    process.stdout.write("Verified production frontend and API artifacts.\n");
  } catch {
    process.stderr.write("Production artifact staging failed. Check builds, dependency installation and output contents.\n");
    process.exitCode = 1;
  }
}
