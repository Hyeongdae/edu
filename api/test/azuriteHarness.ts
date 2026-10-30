import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { TableClient } from "@azure/data-tables";

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((accept, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", accept);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to reserve emulator port.");
  await new Promise<void>((accept, reject) => server.close((error) => error ? reject(error) : accept()));
  return address.port;
}

function listening(port: number): Promise<boolean> {
  return new Promise((accept) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(200);
    socket.once("connect", () => { socket.destroy(); accept(true); });
    socket.once("error", () => { socket.destroy(); accept(false); });
    socket.once("timeout", () => { socket.destroy(); accept(false); });
  });
}

export async function startAzurite(): Promise<{ client: (tableName: string) => TableClient; stop: () => Promise<void> }> {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, "dex-table-test-"));
  const port = await freePort();
  const account = "dextest";
  const key = randomBytes(64).toString("base64"); // ephemeral emulator-only key, never a production setting
  const endpoint = new URL(`http://127.0.0.1:${port}/${account}`);
  if (endpoint.hostname !== "127.0.0.1" || endpoint.protocol !== "http:") throw new Error("Emulator must be loopback only.");
  const require = createRequire(import.meta.url);
  const executable = join(dirname(require.resolve("azurite/package.json")), "dist/src/table/main.js");
  const child = spawn(process.execPath, [executable,
    "--tableHost", "127.0.0.1", "--tablePort", String(port), "--location", directory,
    "--silent", "--skipApiVersionCheck", "--disableProductStyleUrl", "--disableTelemetry",
  ], { cwd: directory, windowsHide: true, stdio: "ignore", env: { ...process.env, AZURITE_ACCOUNTS: `${account}:${key}` } });
  let launchFailed = false;
  child.once("error", () => { launchFailed = true; });
  let stopped = false;

  async function stop(): Promise<void> {
    if (stopped) return;
    stopped = true;
    if (child.exitCode === null && child.signalCode === null && !launchFailed) {
      await new Promise<void>((accept) => {
        child.once("exit", () => accept());
        child.kill();
      });
    }
    const target = await realpath(directory);
    const inside = relative(temporaryRoot, target);
    if (resolve(target) === resolve(temporaryRoot) || inside.startsWith(".." + sep) || inside === ".." ||
      dirname(target) !== temporaryRoot || !inside.startsWith("dex-table-test-")) {
      throw new Error("Refusing to remove an unowned emulator directory.");
    }
    await rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }

  try {
    const deadline = Date.now() + 12000;
    while (!await listening(port)) {
      if (launchFailed) throw new Error("Isolated Azurite process could not launch.");
      if (child.exitCode !== null) throw new Error(`Isolated Azurite exited before startup (code ${child.exitCode}).`);
      if (Date.now() > deadline) throw new Error("Isolated Azurite did not open its loopback port within 12 seconds.");
      await delay(80);
    }
    return {
      client: (tableName) => {
        if (stopped || !/^Players[a-f0-9]{32}$/.test(tableName)) throw new Error("Invalid isolated test table.");
        // Deliberately constructed here, never read from process.env GAME_RECORDS_CONNECTION_STRING.
        return TableClient.fromConnectionString(
          `DefaultEndpointsProtocol=http;AccountName=${account};AccountKey=${key};TableEndpoint=${endpoint.href};`,
          tableName, { allowInsecureConnection: true, retryOptions: { maxRetries: 0 } },
        );
      },
      stop,
    };
  } catch (error) {
    await stop();
    throw error;
  }
}
