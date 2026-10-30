import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const tenantPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildStaticWebAppConfig(template, tenantId) {
  if (typeof tenantId !== "string" || !tenantPattern.test(tenantId) || tenantId === "00000000-0000-0000-0000-000000000000") {
    throw new Error("ENTRA_TENANT_ID must be a non-empty tenant UUID.");
  }
  const config = structuredClone(template);
  const provider = config?.auth?.identityProviders?.azureActiveDirectory;
  if (provider?.registration?.openIdIssuer !== "https://login.microsoftonline.com/__TENANT_ID__/v2.0" ||
    provider.registration.clientIdSettingName !== "AZURE_CLIENT_ID" ||
    provider.registration.clientSecretSettingName !== "GAME_ENTRA_CLIENT_SECRET" ||
    provider.userDetailsClaim !== "name" || Object.keys(config.auth.identityProviders).length !== 1 ||
    Object.keys(config.auth).length !== 1 || Object.keys(provider).some((key) => !["userDetailsClaim", "registration"].includes(key)) ||
    config.platform?.apiRuntime !== "node:22" || "navigationFallback" in config) throw new Error("Invalid protected hosting template.");
  const expectedRoutes = [
    { route: "/descent-test*", statusCode: 404 }, { route: "/preview*", statusCode: 404 },
    { route: "/.auth/*", allowedRoles: ["anonymous"] },
    { route: "/api/*", allowedRoles: ["authenticated"], headers: { "Cache-Control": "no-store" } },
    { route: "/*", allowedRoles: ["authenticated"] },
  ];
  if (JSON.stringify(config.routes) !== JSON.stringify(expectedRoutes) ||
    JSON.stringify(config.responseOverrides) !== JSON.stringify({ 401: { statusCode: 302, redirect: "/.auth/login/aad" } }) ||
    Object.keys(config).some((key) => !["routes", "responseOverrides", "auth", "platform"].includes(key)) ||
    Object.keys(provider.registration).some((key) => !["openIdIssuer", "clientIdSettingName", "clientSecretSettingName"].includes(key))) {
    throw new Error("Hosting routes or authentication settings are not protected.");
  }
  provider.registration.openIdIssuer = `https://login.microsoftonline.com/${tenantId.toLowerCase()}/v2.0`;
  return config;
}

export async function writeStaticWebAppConfig({ templatePath, outputDirectory, tenantId }) {
  // Requiring index.html prevents a successful config command from masking a missing Vite build.
  await readFile(join(outputDirectory, "index.html"));
  const template = JSON.parse(await readFile(templatePath, "utf8"));
  const config = buildStaticWebAppConfig(template, tenantId);
  await writeFile(join(outputDirectory, "staticwebapp.config.json"), JSON.stringify(config, null, 2) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await writeStaticWebAppConfig({ templatePath: resolve("deploy/staticwebapp.template.json"),
      outputDirectory: resolve("dist"), tenantId: process.env.ENTRA_TENANT_ID });
    process.stdout.write("Protected config written to dist/staticwebapp.config.json\n");
  } catch {
    process.stderr.write("Hosting config generation failed. Check ENTRA_TENANT_ID, template and frontend build.\n");
    process.exitCode = 1;
  }
}
