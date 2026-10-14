import { createNodePostgresClient } from "../../../packages/db/src/index.ts";

export type HealthStatus = "ok" | "error";

export type ServiceCheck = {
  name: string;
  status: HealthStatus;
  detail?: string;
  expectedChainId?: number;
  observedChainId?: number;
};

export type RuntimeHealthReport = {
  status: "ok" | "degraded";
  service: string;
  expectedChainId?: number;
  observedChainId?: number;
  checks: ServiceCheck[];
};

export const checkPostgres = async (databaseUrl: string): Promise<ServiceCheck> => {
  try {
    const client = await createNodePostgresClient({ connectionString: databaseUrl });
    await client.query("select 1 as ok");
    return {
      name: "postgres",
      status: "ok"
    };
  } catch (error) {
    return {
      name: "postgres",
      status: "error",
      detail: error instanceof Error ? error.message : "unknown_error"
    };
  }
};

export const checkArcRpc = async (
  rpcUrl: string,
  expectedChainId?: number
): Promise<ServiceCheck> => {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: []
      })
    });

    if (!response.ok) {
      return {
        name: "arc_rpc",
        status: "error",
        detail: `http_${response.status}`,
        expectedChainId
      };
    }

    const payload = (await response.json()) as { result?: string; error?: unknown };

    if (!payload.result) {
      return {
        name: "arc_rpc",
        status: "error",
        detail: "missing_chain_id",
        expectedChainId
      };
    }

    const numericChainId = parseInt(payload.result, 16);
    if (expectedChainId !== undefined && numericChainId !== expectedChainId) {
      return {
        name: "arc_rpc",
        status: "error",
        detail: `chain_id_mismatch: remote=${numericChainId}, expected=${expectedChainId}`,
        expectedChainId,
        observedChainId: numericChainId
      };
    }

    return {
      name: "arc_rpc",
      status: "ok",
      detail: payload.result,
      expectedChainId,
      observedChainId: numericChainId
    };
  } catch (error) {
    return {
      name: "arc_rpc",
      status: "error",
      detail: error instanceof Error ? error.message : "unknown_error",
      expectedChainId
    };
  }
};

export const checkPrivyConfig = (
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): ServiceCheck => ({
  name: "privy",
  status: env.PRIVY_APP_ID && env.PRIVY_APP_SECRET ? "ok" : "error",
  detail:
    env.PRIVY_APP_ID && env.PRIVY_APP_SECRET
      ? "configured"
      : "missing_credentials"
});

export const getRuntimeHealth = async ({
  databaseUrl,
  arcRpcUrl,
  expectedChainId,
  env = process.env
}: {
  databaseUrl: string;
  arcRpcUrl: string;
  expectedChainId?: number;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): Promise<RuntimeHealthReport> => {
  const checks = await Promise.all([
    checkPostgres(databaseUrl),
    checkArcRpc(arcRpcUrl, expectedChainId),
    Promise.resolve(checkPrivyConfig(env))
  ]);

  const arcCheck = checks.find((c) => c.name === "arc_rpc");

  return {
    status: checks.every((check) => check.status === "ok") ? "ok" : "degraded",
    service: "microcosm-api",
    expectedChainId,
    observedChainId: arcCheck?.observedChainId,
    checks
  };
};
