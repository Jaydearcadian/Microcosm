export const workerAppName = "microcosm-worker";

export type WorkerJob = {
  id: string;
  type: "settlement.execute";
  paymentId: string;
  settlementId: string;
  status: "queued" | "processing" | "completed";
  leaseOwner?: string;
  leasedAt?: string;
  result?: {
    txHash?: string;
  };
};

type ClaimJobOptions = {
  leaseTimeoutMs?: number;
  now?: string;
};

export const createWorkerApp = ({
  settlements,
  jobs: initialJobs = []
}: {
  settlements:
    | Array<{
        id: string;
        paymentId: string;
        status: "planned" | "settled" | "claimed";
      } & Record<string, unknown>>
    | (() => Array<{
        id: string;
        paymentId: string;
        status: "planned" | "settled" | "claimed";
      } & Record<string, unknown>>);
  jobs?: WorkerJob[];
}) => {
  const jobs: WorkerJob[] = structuredClone(initialJobs);
  const listSettlements = () =>
    typeof settlements === "function" ? settlements() : settlements;
  const snapshot = <T>(value: T): T => structuredClone(value);

  const ensureQueuedJob = (paymentId: string) => {
    const settlement = listSettlements().find(
      (entry) => entry.paymentId === paymentId && entry.status === "planned"
    );
    if (!settlement) {
      throw new Error(`No planned settlement found for payment: ${paymentId}`);
    }

    const existing = jobs.find((job) => job.paymentId === paymentId);
    if (existing) {
      return snapshot(existing);
    }

    const job: WorkerJob = {
      id: `job_${settlement.paymentId}`,
      type: "settlement.execute",
      paymentId: settlement.paymentId,
      settlementId: settlement.id,
      status: "queued"
    };
    jobs.push(job);
    return snapshot(job);
  };

  const getJob = (jobId: string) => {
    const job = jobs.find((entry) => entry.id === jobId);
    if (!job) {
      throw new Error(`Unknown job: ${jobId}`);
    }
    return job;
  };

  return {
    queuePendingSettlementJobs() {
      const queued = listSettlements()
        .filter((settlement) => settlement.status === "planned")
        .map((settlement) => ensureQueuedJob(settlement.paymentId));

      return queued;
    },
    queueSettlementJob(paymentId: string) {
      return ensureQueuedJob(paymentId);
    },
    runJob(jobId: string) {
      const job = getJob(jobId);
      job.status = "completed";
      delete job.leaseOwner;
      delete job.leasedAt;
      return snapshot(job);
    },
    claimNextJob(leaseOwner: string, options: ClaimJobOptions = {}) {
      const nowIso = options.now ?? new Date().toISOString();
      const nowMs = Date.parse(nowIso);
      const leaseTimeoutMs = options.leaseTimeoutMs ?? 5 * 60 * 1000;
      const job = jobs.find((entry) => {
        if (entry.status === "queued") {
          return true;
        }

        if (
          entry.status === "processing" &&
          entry.leasedAt &&
          Number.isFinite(nowMs)
        ) {
          const leasedAtMs = Date.parse(entry.leasedAt);
          return Number.isFinite(leasedAtMs) && nowMs - leasedAtMs >= leaseTimeoutMs;
        }

        return false;
      });
      if (!job) {
        return undefined;
      }

      job.status = "processing";
      job.leaseOwner = leaseOwner;
      job.leasedAt = nowIso;
      return snapshot(job);
    },
    async processJob(
      jobId: string,
      executor: (job: WorkerJob) => Promise<{ txHash?: string }>
    ) {
      const job = getJob(jobId);

      if (job.status === "queued") {
        job.status = "processing";
      }

      const result = await executor(snapshot(job));
      job.status = "completed";
      delete job.leaseOwner;
      delete job.leasedAt;
      job.result = result;
      return snapshot(job);
    },
    async drainQueuedJobs(
      leaseOwner: string,
      executor: (job: WorkerJob) => Promise<{ txHash?: string }>
    ) {
      const processed: WorkerJob[] = [];

      while (true) {
        const leased = this.claimNextJob(leaseOwner);
        if (!leased) {
          break;
        }

        processed.push(await this.processJob(leased.id, executor));
      }

      return processed;
    },
    hydrate(seedJobs: WorkerJob[]) {
      jobs.splice(0, jobs.length, ...seedJobs.map((job) => snapshot(job)));
    },
    listJobs() {
      return jobs.map((job) => snapshot(job));
    }
  };
};
