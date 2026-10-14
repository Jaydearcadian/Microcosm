import { getApiRuntimeConfig } from "./runtime.ts";
import { getRuntimeHealth } from "./health.ts";

const main = async () => {
  const config = getApiRuntimeConfig();
  const health = await getRuntimeHealth({
    databaseUrl: config.databaseUrl,
    arcRpcUrl: config.arcRpcUrl,
    expectedChainId: config.arcChainId
  });

  console.log(
    JSON.stringify(
      {
        ok: health.status === "ok",
        databaseUrl: config.databaseUrl,
        privyAppId: config.privyAppId,
        port: config.port,
        health
      },
      null,
      2
    )
  );
};

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "runtime_check_failed"
  );
  process.exitCode = 1;
});
