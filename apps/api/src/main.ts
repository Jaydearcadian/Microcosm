import { createApiServer } from "./server.ts";
import { getApiRuntimeConfig } from "./runtime.ts";
import { getRuntimeHealth } from "./health.ts";

const main = async () => {
  const config = getApiRuntimeConfig();
  const health = await getRuntimeHealth({
    databaseUrl: config.databaseUrl,
    arcRpcUrl: config.arcRpcUrl,
    expectedChainId: config.arcChainId
  });

  if (health.status !== "ok") {
    throw new Error(JSON.stringify(health));
  }

  const server = createApiServer({
    databaseUrl: config.databaseUrl,
    settlement: {
      privateKey: config.arcSettlementPrivateKey,
      contracts: config.arcContracts
    }
  });

  await server.start(config.port);

  console.log(
    JSON.stringify(
      {
        ok: true,
        service: "microcosm-api",
        url: server.url,
        port: config.port
      },
      null,
      2
    )
  );
};

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Failed to start microcosm API"
  );
  process.exitCode = 1;
});
