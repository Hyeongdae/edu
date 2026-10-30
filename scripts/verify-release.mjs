import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { buildStaticWebAppConfig } from "./build-staticwebapp-config.mjs";
import { verifyApiPackage, verifyFrontendArtifact } from "./stage-api.mjs";

export async function verifyRelease({ expectedSha, tenantId, root = "." }) {
  if (typeof expectedSha !== "string" || !/^(?:[0-9a-f]{40}|local)$/.test(expectedSha)) throw new Error("Expected a verified source revision.");
  const read = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
  const manifest = await read("release/build-manifest.json");
  if (manifest.schemaVersion !== 1 || manifest.sourceSha !== expectedSha || manifest.frontend !== "dist" || manifest.api !== "release/api") {
    throw new Error("Artifact does not match this source revision.");
  }
  const expected = buildStaticWebAppConfig(await read("deploy/staticwebapp.template.json"), tenantId);
  if (!isDeepStrictEqual(expected, await read("dist/staticwebapp.config.json"))) throw new Error("Unexpected deployed authentication configuration.");
  await verifyApiPackage(resolve(root, "release/api"));
  await verifyFrontendArtifact(resolve(root, "dist"), true);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await verifyRelease({ expectedSha: process.env.GITHUB_SHA, tenantId: process.env.ENTRA_TENANT_ID });
    process.stdout.write("Source revision, authentication config and production artifacts verified.\n");
  } catch {
    process.stderr.write("Release verification failed. Check source revision, tenant and artifacts.\n");
    process.exitCode = 1;
  }
}
