import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { buildStaticWebAppConfig, writeStaticWebAppConfig } from "./build-staticwebapp-config.mjs";
import { stageApi, verifyApiPackage, verifyFrontendArtifact } from "./stage-api.mjs";

const tenant = "11111111-2222-4333-8444-555555555555";
const templatePath = resolve("deploy/staticwebapp.template.json");
const template = JSON.parse(await readFile(templatePath, "utf8"));
async function directory(t) {
  const base = await realpath(tmpdir());
  const path = await mkdtemp(join(base, "dex-deploy-test-"));
  t.after(async () => {
    const actual = await realpath(path);
    assert.equal(dirname(actual), base);
    assert.ok(basename(actual).startsWith("dex-deploy-test-"));
    await rm(actual, { recursive: true });
  });
  return path;
}

test("binds a tenant-specific provider with only server setting references and preserves input", () => {
  const before = structuredClone(template);
  const config = buildStaticWebAppConfig(template, tenant.toUpperCase());
  assert.equal(config.auth.identityProviders.azureActiveDirectory.registration.openIdIssuer, `https://login.microsoftonline.com/${tenant}/v2.0`);
  assert.equal(config.platform.apiRuntime, "node:22");
  assert.deepEqual(template, before);
  assert.equal(config.navigationFallback, undefined);
  assert.equal(JSON.stringify(config).includes("__TENANT_ID__"), false);
});

for (const value of [undefined, "", "common", "organizations", "tenant", " " + tenant, "00000000-0000-0000-0000-000000000000"]) {
  test(`rejects missing/unsafe tenant ${value}`, () => assert.throws(() => buildStaticWebAppConfig(template, value)));
}

test("requires authenticated assets/API while leaving platform auth available and blocking local previews", () => {
  const config = buildStaticWebAppConfig(template, tenant);
  const match = (path) => config.routes.find((rule) => rule.route.endsWith("*") ? path.startsWith(rule.route.slice(0, -1)) : path === rule.route);
  for (const path of ["/", "/index.html", "/assets/index.js", "/audio/stone-step.ogg", "/api/profile", "/api/results"]) {
    assert.deepEqual(match(path).allowedRoles, ["authenticated"]);
  }
  assert.deepEqual(match("/.auth/login/aad").allowedRoles, ["anonymous"]);
  assert.equal(match("/descent-test.html").statusCode, 404);
  assert.equal(match("/preview.html").statusCode, 404);
  assert.equal(match("/api/profile").headers["Cache-Control"], "no-store");
});

test("rejects accidental public routes, fallback rewrites or literal secrets", () => {
  const variants = [
    { ...template, navigationFallback: { rewrite: "/index.html" } },
    { ...template, routes: [{ route: "/*", allowedRoles: ["anonymous"] }] },
    { ...template, auth: { ...template.auth, secret: "fixture-only" } },
    { ...template, auth: { identityProviders: { azureActiveDirectory: {
      ...template.auth.identityProviders.azureActiveDirectory, clientSecret: "fixture-only",
    } } } },
  ];
  for (const unsafe of variants) assert.throws(() => buildStaticWebAppConfig(unsafe, tenant));
});

test("writes config only into an existing completed frontend output", async (t) => {
  const outputDirectory = await directory(t);
  await assert.rejects(writeStaticWebAppConfig({ templatePath, outputDirectory, tenantId: tenant }));
  await writeFile(join(outputDirectory, "index.html"), "built");
  await writeStaticWebAppConfig({ templatePath, outputDirectory, tenantId: tenant });
  assert.deepEqual(JSON.parse(await readFile(join(outputDirectory, "staticwebapp.config.json"), "utf8")), buildStaticWebAppConfig(template, tenant));
});

test("stages only runtime API files and resolves dependencies from that artifact", async (t) => {
  const root = await directory(t), sourceDirectory = join(root, "source"), outputDirectory = join(root, "output");
  await mkdir(join(sourceDirectory, "dist"), { recursive: true });
  await writeFile(join(sourceDirectory, "package.json"), JSON.stringify({ main: "dist/index.cjs", dependencies: { "@azure/functions": "fixture", "@azure/cosmos": "fixture" } }));
  for (const path of ["package-lock.json", "host.json", "dist/index.cjs", "local.settings.json", "secret.txt"]) await writeFile(join(sourceDirectory, path), "{}");
  const install = async (output) => {
    for (const name of ["@azure/functions", "@azure/cosmos"]) {
      await mkdir(join(output, "node_modules", name), { recursive: true });
      await writeFile(join(output, "node_modules", name, "package.json"), '{"main":"index.js"}');
      await writeFile(join(output, "node_modules", name, "index.js"), "module.exports = {};");
    }
  };
  await stageApi({ sourceDirectory, outputDirectory, install });
  await verifyApiPackage(outputDirectory);
  await assert.rejects(readFile(join(outputDirectory, "local.settings.json")));
  await assert.rejects(stageApi({ sourceDirectory, outputDirectory: join(sourceDirectory, "..nested"), install }));
  await mkdir(join(outputDirectory, "node_modules", "azurite"));
  await assert.rejects(verifyApiPackage(outputDirectory), /Development dependency/);
});

test("rejects unknown public artifact content including nested secrets", async (t) => {
  const root = await directory(t);
  await mkdir(join(root, "assets")); await mkdir(join(root, "audio"));
  await writeFile(join(root, "index.html"), "built");
  await writeFile(join(root, "assets", "index-fixture.js"), "built");
  for (const name of ["LICENSES.md", "fall-thud.mp3", "stair-climb-bgm.mp3", "stone-step.ogg"]) await writeFile(join(root, "audio", name), "public");
  await verifyFrontendArtifact(root);
  await writeFile(join(root, "audio", ".env.local"), "fixture-only");
  await assert.rejects(verifyFrontendArtifact(root), /Unexpected audio/);
});

test("workflow deploy is gated to tested main artifacts and keeps secrets out of PR verification", async () => {
  const workflow = await readFile(resolve(".github/workflows/azure-company-game.yml"), "utf8");
  const [verify, deploy] = workflow.split("  deploy:");
  assert.ok(!verify.includes("secrets."));
  assert.match(deploy, /needs: verify/);
  assert.match(deploy, /github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' && vars\.AZURE_DEPLOY_ENABLED == 'true'/);
  assert.match(deploy, /skip_app_build: true/); assert.match(deploy, /skip_api_build: true/);
  assert.match(deploy, /api_location: release\/api/);
  assert.match(deploy, /scripts\/verify-release\.mjs/);
  assert.ok(!workflow.includes("pull_request_target")); assert.ok(!workflow.includes("repo_token:"));
});
