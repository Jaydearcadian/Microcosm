import type { ResolvedRecipient } from "../../recipient-resolution/src/index.ts";
import type { ArcContractClient } from "../../adapters/arc/src/index.ts";

export type SettlementPlan =
  | {
      chain: "arc";
      mode: "direct";
      paymentId: string;
      amount: string;
      asset: string;
      destination: string;
    }
  | {
      chain: "arc";
      mode: "claimable";
      paymentId: string;
      amount: string;
      asset: string;
      escrowId: string;
      lookupKey: string;
    };

export type SettlementRecord = {
  id: string;
  paymentId: string;
  chain: "arc";
  mode: "direct" | "claimable";
  status: "planned" | "settled" | "claimed";
  amount: string;
  asset: string;
  destination?: string;
  escrowId?: string;
  lookupKey?: string;
  txHash?: string;
  simulated?: boolean;
  confirmationStatus?: "pending" | "confirmed";
  confirmationAttempts?: number;
  lastConfirmationCheckAt?: string;
  confirmedAt?: string;
};

export type SettlementExecutor = {
  plan: (input: {
    paymentId: string;
    amount: string;
    asset: string;
    recipient: ResolvedRecipient;
  }) => SettlementPlan;
  execute: (plan: SettlementPlan) => {
    status: "settled";
    simulated?: boolean;
    txHash?: string;
    escrowId?: string;
    destination?: string;
  };
  executeAsync: (plan: SettlementPlan) => Promise<{
    status: "settled";
    simulated?: boolean;
    txHash?: string;
    escrowId?: string;
    destination?: string;
  }>;
  claim: (
    plan: Extract<SettlementPlan, { mode: "claimable" }>,
    input: { walletAddress: string }
  ) => {
    status: "claimed";
    escrowId: string;
    destination: string;
  };
};

type ArcContractsConfig = {
  settlementRouter?: string;
  claimEscrow?: string;
};

type DirectContractSettlementInput = {
  contractAddress: string;
  paymentId: string;
  amount: string;
  asset: string;
  destination: string;
};

export type SettlementStore = {
  create: (plan: SettlementPlan) => SettlementRecord;
  get: (paymentId: string) => SettlementRecord | undefined;
  list: () => SettlementRecord[];
  listPendingConfirmations: () => SettlementRecord[];
  hydrate: (records: SettlementRecord[]) => void;
  markSettled: (
    paymentId: string,
    result: {
      status: "settled";
      simulated?: boolean;
      txHash?: string;
      escrowId?: string;
      destination?: string;
    }
  ) => SettlementRecord;
  markClaimed: (
    paymentId: string,
    result: {
      status: "claimed";
      escrowId: string;
      destination: string;
    }
  ) => SettlementRecord;
  markConfirmationChecked: (
    paymentId: string,
    input?: { checkedAt?: string }
  ) => SettlementRecord;
  markConfirmed: (
    paymentId: string,
    input?: { confirmedAt?: string }
  ) => SettlementRecord;
};

export type SettlementConfirmationLoop = {
  runPendingConfirmations: () => Promise<
    Array<{ paymentId: string; txHash: string; confirmed: boolean }>
  >;
};

export type TxConfirmer = (
  txHash: string
) => Promise<{ confirmed: boolean; checkedAt?: string }>;

const clone = <T>(value: T): T => structuredClone(value);

export const createSettlementRecord = (plan: SettlementPlan): SettlementRecord => ({
  id: `stl_${plan.paymentId}`,
  paymentId: plan.paymentId,
  chain: plan.chain,
  mode: plan.mode,
  status: "planned",
  amount: plan.amount,
  asset: plan.asset,
  confirmationAttempts: 0,
  destination: plan.mode === "direct" ? plan.destination : undefined,
  escrowId: plan.mode === "claimable" ? plan.escrowId : undefined,
  lookupKey: plan.mode === "claimable" ? plan.lookupKey : undefined
});

export const createSettlementStore = (): SettlementStore => {
  const records = new Map<string, SettlementRecord>();

  return {
    create(plan) {
      const record = createSettlementRecord(plan);
      records.set(plan.paymentId, record);
      return clone(record);
    },
    get(paymentId) {
      const record = records.get(paymentId);
      return record ? clone(record) : undefined;
    },
    list() {
      return [...records.values()].map((record) => clone(record));
    },
    listPendingConfirmations() {
      return [...records.values()]
        .filter((record) => record.confirmationStatus === "pending" && !!record.txHash)
        .map((record) => clone(record));
    },
    hydrate(entries) {
      records.clear();
      entries.forEach((entry) => {
        records.set(entry.paymentId, clone(entry));
      });
    },
    markSettled(paymentId, result) {
      const existing = records.get(paymentId);
      if (!existing) {
        throw new Error(`Unknown settlement for payment: ${paymentId}`);
      }

      const updated: SettlementRecord = {
        ...existing,
        status: "settled",
        txHash: result.txHash ?? existing.txHash,
        escrowId: result.escrowId ?? existing.escrowId,
        destination: result.destination ?? existing.destination,
        simulated: result.simulated ?? existing.simulated,
        confirmationStatus:
          result.simulated === false && result.txHash
            ? "pending"
            : "confirmed",
        confirmationAttempts:
          result.simulated === false && result.txHash
            ? existing.confirmationAttempts ?? 0
            : existing.confirmationAttempts ?? 0,
        confirmedAt:
          result.simulated === false && result.txHash
            ? existing.confirmedAt
            : new Date().toISOString()
      };
      records.set(paymentId, updated);
      return clone(updated);
    },
    markClaimed(paymentId, result) {
      const existing = records.get(paymentId);
      if (!existing) {
        throw new Error(`Unknown settlement for payment: ${paymentId}`);
      }

      const updated: SettlementRecord = {
        ...existing,
        status: "claimed",
        escrowId: result.escrowId,
        destination: result.destination
      };
      records.set(paymentId, updated);
      return clone(updated);
    },
    markConfirmationChecked(paymentId, input = {}) {
      const existing = records.get(paymentId);
      if (!existing) {
        throw new Error(`Unknown settlement for payment: ${paymentId}`);
      }

      const updated: SettlementRecord = {
        ...existing,
        lastConfirmationCheckAt: input.checkedAt ?? new Date().toISOString(),
        confirmationAttempts: (existing.confirmationAttempts ?? 0) + 1
      };
      records.set(paymentId, updated);
      return clone(updated);
    },
    markConfirmed(paymentId, input = {}) {
      const existing = records.get(paymentId);
      if (!existing) {
        throw new Error(`Unknown settlement for payment: ${paymentId}`);
      }

      const checkedAt = input.confirmedAt ?? new Date().toISOString();
      const updated: SettlementRecord = {
        ...existing,
        confirmationStatus: "confirmed",
        confirmedAt: checkedAt,
        lastConfirmationCheckAt: checkedAt,
        confirmationAttempts: (existing.confirmationAttempts ?? 0) + 1
      };
      records.set(paymentId, updated);
      return clone(updated);
    }
  };
};

export const createSettlementConfirmationLoop = ({
  settlements,
  confirmTx
}: {
  settlements: SettlementStore;
  confirmTx: TxConfirmer;
}): SettlementConfirmationLoop => ({
  async runPendingConfirmations() {
    const pending = settlements.listPendingConfirmations();
    const results: Array<{ paymentId: string; txHash: string; confirmed: boolean }> = [];

    for (const record of pending) {
      if (!record.txHash) {
        continue;
      }

      const result = await confirmTx(record.txHash);
      if (result.confirmed) {
        settlements.markConfirmed(record.paymentId, {
          confirmedAt: result.checkedAt
        });
      } else {
        settlements.markConfirmationChecked(record.paymentId, {
          checkedAt: result.checkedAt
        });
      }

      results.push({
        paymentId: record.paymentId,
        txHash: record.txHash,
        confirmed: result.confirmed
      });
    }

    return results;
  }
});

export const createArcSettlementConfirmer = ({
  rpcUrl,
  fetchImpl = fetch
}: {
  rpcUrl: string;
  fetchImpl?: typeof fetch;
}): TxConfirmer => async (txHash: string) => {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionReceipt",
      params: [txHash]
    })
  });

  if (!response.ok) {
    throw new Error(`Arc receipt lookup failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    result?: {
      blockHash?: string | null;
      status?: string | null;
    } | null;
  };
  const receipt = payload.result;

  return {
    confirmed:
      !!receipt &&
      typeof receipt.blockHash === "string" &&
      receipt.blockHash.length > 0 &&
      receipt.status !== "0x0",
    checkedAt: new Date().toISOString()
  };
};

export const createArcSettlementExecutor = ({
  privateKey,
  contracts,
  submitDirectContractSettlement,
  arcClient
}: {
  privateKey?: string;
  contracts?: ArcContractsConfig;
  submitDirectContractSettlement?: (
    input: DirectContractSettlementInput
  ) => Promise<{ txHash?: string }>;
  arcClient?: Pick<ArcContractClient, "settleDirect">;
} = {}): SettlementExecutor => {
  const plan: SettlementExecutor["plan"] = ({
    paymentId,
    amount,
    asset,
    recipient
  }) => {
    if (recipient.claimStatus === "pending-claim") {
      return {
        chain: "arc",
        mode: "claimable",
        paymentId,
        amount,
        asset,
        escrowId: contracts?.claimEscrow
          ? `${contracts.claimEscrow}:${paymentId}`
          : `escrow:${paymentId}`,
        lookupKey: recipient.lookupKey
      };
    }

    if (!recipient.walletAddress) {
      throw new Error(`Recipient ${recipient.id} is missing a wallet address`);
    }

    return {
      chain: "arc",
      mode: "direct",
      paymentId,
      amount,
      asset,
      destination: recipient.walletAddress
    };
  };

  return {
    plan,
    execute: (settlementPlan) => {
      if (settlementPlan.mode === "direct") {
        if (!privateKey) {
          return {
            status: "settled",
            simulated: true,
            txHash: `0xsettled_${settlementPlan.paymentId}`,
            destination: settlementPlan.destination
          };
        }

        return {
          status: "settled",
          simulated: true,
          txHash: `0xqueued_${settlementPlan.paymentId}`,
          destination: settlementPlan.destination
        };
      }

      return {
        status: "settled",
        simulated: true,
        escrowId: settlementPlan.escrowId
      };
    },
    claim: (settlementPlan, input) => ({
      status: "claimed",
      escrowId: settlementPlan.escrowId,
      destination: input.walletAddress
    }),
    async executeAsync(settlementPlan: SettlementPlan) {
      if (settlementPlan.mode !== "direct") {
        return {
          status: "settled" as const,
          simulated: true,
          escrowId: settlementPlan.escrowId
        };
      }

      if (!privateKey) {
        return {
          status: "settled" as const,
          simulated: true,
          txHash: `0xsettled_${settlementPlan.paymentId}`,
          destination: settlementPlan.destination
        };
      }

      if (contracts?.settlementRouter && submitDirectContractSettlement) {
        const result = await submitDirectContractSettlement({
          contractAddress: contracts.settlementRouter,
          paymentId: settlementPlan.paymentId,
          amount: settlementPlan.amount,
          asset: settlementPlan.asset,
          destination: settlementPlan.destination
        });

        return {
          status: "settled" as const,
          simulated: false,
          txHash: result.txHash,
          destination: settlementPlan.destination
        };
      }

      if (contracts?.settlementRouter && arcClient) {
        const txHash = await arcClient.settleDirect({
          paymentId: settlementPlan.paymentId,
          amount: settlementPlan.amount,
          recipient: settlementPlan.destination
        });

        return {
          status: "settled" as const,
          simulated: false,
          txHash,
          destination: settlementPlan.destination
        };
      }

      const [{ AppKit }, { createViemAdapterFromPrivateKey }] = await Promise.all([
        import("@circle-fin/app-kit"),
        import("@circle-fin/adapter-viem-v2")
      ]);
      const kit = new AppKit();
      const adapter = createViemAdapterFromPrivateKey({ privateKey });
      const result = await kit.send({
        from: { adapter, chain: "Arc_Testnet" },
        to: settlementPlan.destination,
        amount: settlementPlan.amount,
        token: "USDC"
      });
      const txHash =
        "txHash" in result && typeof result.txHash === "string"
          ? result.txHash
          : undefined;

      return {
        status: "settled" as const,
        simulated: false,
        txHash,
        destination: settlementPlan.destination
      };
    }
  };
};
