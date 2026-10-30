import { CosmosClient, type Container } from "@azure/cosmos";
import { randomUUID } from "node:crypto";
import type { PlayerContainer } from "../src/playerRepository";

const EMULATOR_KEY = "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==";
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "cosmos-emulator"]);
const PRODUCTION_SETTINGS = [
  "GAME_RECORDS_COSMOS_CONNECTION_STRING",
  "GAME_RECORDS_COSMOS_DATABASE",
  "GAME_RECORDS_COSMOS_CONTAINER",
  "GAME_RECORDS_CONNECTION_STRING",
  "GAME_RECORDS_TABLE",
] as const;

export interface CosmosEmulatorHarness {
  container: PlayerContainer;
  close(): Promise<void>;
}

function getEmulatorEndpoint(): string {
  if (PRODUCTION_SETTINGS.some((name) => Object.hasOwn(process.env, name))) {
    throw new Error("Cosmos integration tests refuse production record settings.");
  }
  const configuredEndpoint = process.env.COSMOS_EMULATOR_ENDPOINT;
  if (!configuredEndpoint) throw new Error("Set COSMOS_EMULATOR_ENDPOINT to a local Cosmos emulator gateway.");

  let endpoint: URL;
  try {
    endpoint = new URL(configuredEndpoint);
  } catch {
    throw new Error("COSMOS_EMULATOR_ENDPOINT must be a local HTTP(S) URL.");
  }
  if (!new Set(["http:", "https:"]).has(endpoint.protocol) || !ALLOWED_HOSTS.has(endpoint.hostname) ||
    endpoint.port !== "8081" || endpoint.pathname !== "/" || endpoint.username || endpoint.password ||
    endpoint.search || endpoint.hash) {
    throw new Error("COSMOS_EMULATOR_ENDPOINT must use the local emulator gateway on port 8081.");
  }
  return endpoint.href;
}

export async function createCosmosEmulatorHarness(): Promise<CosmosEmulatorHarness> {
  const endpoint = getEmulatorEndpoint();
  const client = new CosmosClient({ endpoint, key: EMULATOR_KEY });
  const databaseId = `test_${randomUUID().replaceAll("-", "")}`;
  const containerId = `Players${randomUUID().replaceAll("-", "")}`;
  let databaseCreated = false;
  let closed = false;

  async function close(): Promise<void> {
    if (closed) return;
    closed = true;
    try {
      if (databaseCreated) await client.database(databaseId).delete();
    } finally {
      client.dispose();
    }
  }

  try {
    const { database } = await client.databases.createIfNotExists({ id: databaseId });
    databaseCreated = true;
    const { container } = await database.containers.create({
      id: containerId,
      partitionKey: { paths: ["/accountId"] },
    }, { offerThroughput: 400 });
    return { container: container as unknown as PlayerContainer, close };
  } catch (error) {
    try {
      await close();
    } catch {
      // Preserve the setup failure while still disposing the client.
    }
    throw error;
  }
}

/** A gate around the real Cosmos SDK that makes concurrent requests share an initial item version. */
export function holdFirstItemReadsTogether(container: Container, count = 2): PlayerContainer {
  let arrivals = 0;
  let release!: () => void;
  const allArrived = new Promise<void>((resolve) => { release = resolve; });

  return {
    read: async () => {
      const { resource } = await container.read();
      return { resource: resource ? { id: resource.id, partitionKey: resource.partitionKey } : undefined };
    },
    item: (id, partitionKey) => {
      const item = container.item(id, partitionKey);
      return {
        read: async <T extends import("../src/playerRepository").PlayerDocument>() => {
          try {
            return await item.read<T>();
          } finally {
            if (arrivals < count) {
              arrivals++;
              if (arrivals === count) release();
              await allArrived;
            }
          }
        },
        replace: (document, options) => item.replace(document, options),
      };
    },
    items: {
      create: (document) => container.items.create(document),
      query: (query, options) => container.items.query(query, options),
    },
  };
}
