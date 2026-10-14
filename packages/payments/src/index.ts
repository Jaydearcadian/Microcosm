import type { ResolvedRecipient } from "../../recipient-resolution/src/index.ts";
import type {
  SettlementExecutor,
  SettlementPlan
} from "../../settlement/src/index.ts";
import type { NotificationService } from "../../notifications/src/index.ts";

export type CreatePaymentInput = {
  intentId: string;
  amount: string;
  asset: string;
  recipient: ResolvedRecipient;
  spaceId?: string;
  ownerUserId?: string;
  senderAddress?: string;
  recipientAddress?: string;
  chainId?: number;
  tokenAddress?: string;
  amountDecimal?: string;
  amountBaseUnits?: string;
  calldata?: string;
  status?: PaymentStatus;
  txHash?: string;
};

export type PaymentStatus =
  | "prepared"
  | "ready_for_settlement"
  | "pending_claim"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "settled"
  | "claimed"
  | "failed";

export type PaymentRecord = {
  id: string;
  intentId: string;
  amount: string;
  asset: string;
  recipientId: string;
  status: PaymentStatus;
  spaceId?: string;
  ownerUserId?: string;
  senderAddress?: string;
  recipientAddress?: string;
  chainId?: number;
  tokenAddress?: string;
  amountDecimal?: string;
  amountBaseUnits?: string;
  calldata?: string;
  txHash?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PaymentCreationResult = {
  payment: PaymentRecord;
  settlement: SettlementPlan;
};

export type PersistedPaymentState = {
  payment: PaymentRecord;
  settlement: SettlementPlan;
};

export type PaymentService = {
  create: (input: CreatePaymentInput) => PaymentCreationResult;
  get: (paymentId: string) => PaymentRecord | undefined;
  update: (paymentId: string, updates: Partial<PaymentRecord>) => PaymentRecord;
  transitionStatus: (
    paymentId: string,
    expectedStatus: PaymentStatus | PaymentStatus[],
    newStatus: PaymentStatus,
    extra?: { txHash?: string }
  ) => PaymentRecord;
  execute: (paymentId: string) => {
    payment: PaymentRecord;
    settlement: SettlementPlan;
    status: "settled";
    txHash?: string;
    escrowId?: string;
    destination?: string;
  };
  claim: (
    paymentId: string,
    input: { walletAddress: string }
  ) => {
    payment: PaymentRecord;
    settlement: Extract<SettlementPlan, { mode: "claimable" }>;
    status: "claimed";
    escrowId: string;
    destination: string;
  };
  executeAsync: (paymentId: string) => Promise<{
    payment: PaymentRecord;
    settlement: SettlementPlan;
    status: "settled";
    txHash?: string;
    escrowId?: string;
    destination?: string;
    simulated?: boolean;
  }>;
  exportState: () => PersistedPaymentState[];
  hydrate: (entries: PersistedPaymentState[]) => void;
  list: () => PaymentRecord[];
};

export const createPaymentService = ({
  settlement,
  notifications
}: {
  settlement: SettlementExecutor;
  notifications?: NotificationService;
}): PaymentService => {
  const payments: PaymentRecord[] = [];
  const plans = new Map<string, SettlementPlan>();
  const snapshot = <T>(value: T): T => structuredClone(value);
  const nextPaymentId = () =>
    `pay_${
      payments.reduce((max, payment) => {
        const parsed = Number(payment.id.replace(/^pay_/, ""));
        return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
      }, 0) + 1
    }`;

  return {
    create: (input) => {
      const paymentId = nextPaymentId();
      const settlementPlan = settlement.plan({
        paymentId,
        amount: input.amount,
        asset: input.asset,
        recipient: input.recipient
      });

      const now = new Date().toISOString();
      const initialStatus =
        input.status ??
        (settlementPlan.mode === "claimable"
          ? "pending_claim"
          : "ready_for_settlement");

      const payment: PaymentRecord = {
        id: paymentId,
        intentId: input.intentId,
        amount: input.amount,
        asset: input.asset,
        recipientId: input.recipient.id,
        status: initialStatus,
        spaceId: input.spaceId,
        ownerUserId: input.ownerUserId,
        senderAddress: input.senderAddress,
        recipientAddress: input.recipientAddress,
        chainId: input.chainId,
        tokenAddress: input.tokenAddress,
        amountDecimal: input.amountDecimal,
        amountBaseUnits: input.amountBaseUnits,
        calldata: input.calldata,
        txHash: input.txHash,
        createdAt: now,
        updatedAt: now
      };

      payments.push(payment);
      plans.set(paymentId, settlementPlan);
      void notifications?.emit({
        type:
          settlementPlan.mode === "claimable"
            ? "payment.claim_available"
            : "payment.created",
        channel: recipientChannel(input.recipient),
        recipient: input.recipient.lookupKey,
        payload: {
          paymentId,
          settlementMode: settlementPlan.mode
        }
      });

      return {
        payment: snapshot(payment),
        settlement: snapshot(settlementPlan)
      };
    },
    get: (paymentId) => {
      const payment = payments.find((item) => item.id === paymentId);
      return payment ? snapshot(payment) : undefined;
    },
    update: (paymentId, updates) => {
      const payment = payments.find((item) => item.id === paymentId);
      if (!payment) {
        throw new Error(`Unknown payment: ${paymentId}`);
      }
      Object.assign(payment, updates, { updatedAt: new Date().toISOString() });
      return snapshot(payment);
    },
    transitionStatus: (paymentId, expectedStatus, newStatus, extra = {}) => {
      const payment = payments.find((item) => item.id === paymentId);
      if (!payment) {
        throw new Error(`Unknown payment: ${paymentId}`);
      }
      const expectedList = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
      if (!expectedList.includes(payment.status)) {
        throw new Error(
          `Invalid state transition for payment ${paymentId}: expected ${expectedList.join(" or ")}, found ${payment.status}`
        );
      }
      payment.status = newStatus;
      if (extra.txHash) {
        payment.txHash = extra.txHash;
      }
      payment.updatedAt = new Date().toISOString();
      return snapshot(payment);
    },
    execute: (paymentId) => {
      const payment = payments.find((item) => item.id === paymentId);
      const settlementPlan = plans.get(paymentId);

      if (!payment || !settlementPlan) {
        throw new Error(`Unknown payment: ${paymentId}`);
      }

      const result = settlement.execute(settlementPlan);
      payment.status = "settled";
      void notifications?.emit({
        type: "payment.settled",
        channel: recipientChannel({
          id: payment.recipientId,
          lookupKey: payment.recipientId,
          ownerType: "external",
          claimStatus: "claimed"
        }),
        recipient: payment.recipientId,
        payload: {
          paymentId,
          txHash: result.txHash
        }
      });

      return {
        payment: snapshot(payment),
        settlement: snapshot(settlementPlan),
        ...result
      };
    },
    claim: (paymentId, input) => {
      const payment = payments.find((item) => item.id === paymentId);
      const settlementPlan = plans.get(paymentId);

      if (!payment || !settlementPlan) {
        throw new Error(`Unknown payment: ${paymentId}`);
      }

      if (settlementPlan.mode !== "claimable") {
        throw new Error(`Payment ${paymentId} is not claimable`);
      }

      const result = settlement.claim(settlementPlan, input);
      payment.status = "claimed";
      void notifications?.emit({
        type: "payment.claimed",
        channel: "email",
        recipient: settlementPlan.lookupKey,
        payload: {
          paymentId,
          destination: input.walletAddress
        }
      });

      return {
        payment: snapshot(payment),
        settlement: snapshot(settlementPlan),
        ...result
      };
    },
    async executeAsync(paymentId) {
      const payment = payments.find((item) => item.id === paymentId);
      const settlementPlan = plans.get(paymentId);

      if (!payment || !settlementPlan) {
        throw new Error(`Unknown payment: ${paymentId}`);
      }

      const result = await settlement.executeAsync(settlementPlan);
      payment.status = "settled";
      void notifications?.emit({
        type: "payment.settled",
        channel: "email",
        recipient: payment.recipientId,
        payload: {
          paymentId,
          txHash: result.txHash,
          simulated: result.simulated ?? false
        }
      });

      return {
        payment: snapshot(payment),
        settlement: snapshot(settlementPlan),
        ...result
      };
    },
    exportState: () =>
      payments.map((payment) => ({
        payment: snapshot(payment),
        settlement: snapshot(plans.get(payment.id)!)
      })),
    hydrate(entries) {
      payments.splice(0, payments.length);
      plans.clear();
      entries.forEach((entry) => {
        payments.push(snapshot(entry.payment));
        plans.set(entry.payment.id, snapshot(entry.settlement));
      });
    },
    list: () => payments.map((payment) => snapshot(payment))
  };
};

const recipientChannel = (recipient: {
  lookupKey: string;
  [key: string]: unknown;
}): "email" | "xmtp" =>
  recipient.lookupKey.includes("@") ? "email" : "xmtp";
