import { fileURLToPath } from "node:url";

import { createApiAppAsync } from "../../api/src/index.ts";
import { getApiRuntimeConfig } from "../../api/src/runtime.ts";
import { getRuntimeHealth } from "../../api/src/health.ts";
import { createArcSettlementConfirmer } from "../../../packages/settlement/src/index.ts";

export const createWorkerRuntime = ({
  runQueued,
  runConfirmations,
  workerId,
  intervalMs = 5000
}: {
  runQueued: (workerId: string) => Promise<unknown[]>;
  runConfirmations?: () => Promise<unknown[]>;
  workerId: string;
  intervalMs?: number;
}) => {
  let timer: NodeJS.Timeout | undefined;

  return {
    async runOnce() {
      return runQueued(workerId);
    },
    async runConfirmationPass() {
      return runConfirmations ? runConfirmations() : [];
    },
    start() {
      if (timer) {
        return;
      }

      timer = setInterval(() => {
        void Promise.all([
          runQueued(workerId),
          runConfirmations ? runConfirmations() : Promise.resolve([])
        ]).catch((error: unknown) => {
          console.error(
            error instanceof Error
              ? error.message
              : "Failed to run worker queue pass"
          );
        });
      }, intervalMs);
    },
    stop() {
      if (!timer) {
        return;
      }

      clearInterval(timer);
      timer = undefined;
    }
  };
};

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

  const app = await createApiAppAsync({
    databaseUrl: config.databaseUrl,
    settlement: {
      privateKey: config.arcSettlementPrivateKey,
      contracts: config.arcContracts
    }
  });
  const confirmTx = createArcSettlementConfirmer({
    rpcUrl: config.arcRpcUrl
  });

  const workerId = process.env.WORKER_ID ?? "microcosm-worker-1";
  const intervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? "5000");
  const once = process.env.WORKER_RUN_ONCE === "true";

  const runtime = createWorkerRuntime({
    workerId,
    intervalMs,
    runQueued: app.jobs.runQueued,
    runConfirmations: () => app.settlements.confirmPending(confirmTx)
  });

  const processed = await runtime.runOnce();
  const confirmed = await runtime.runConfirmationPass();

  console.log(
    JSON.stringify(
      {
        ok: true,
        service: "microcosm-worker",
        workerId,
        processed: processed.length,
        confirmed: confirmed.length,
        mode: once ? "once" : "loop"
      },
      null,
      2
    )
  );

  if (once) {
    return;
  }

  runtime.start();
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Failed to start microcosm worker"
    );
    process.exitCode = 1;
  });
}
