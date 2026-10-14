import type { EnvelopeStore } from "../../envelopes/src/index.ts";

export type IntentType = "send_money" | "pay_bill" | "run_payroll";

export type CreateIntentInput = {
  type: IntentType;
  envelopeId: string;
  recipientId: string;
  amount: string;
  asset: string;
  executedAt: string;
  spentToday: string;
  spaceId?: string;
  ownerUserId?: string;
  recipientAddress?: string;
  tokenAddress?: string;
  chainId?: number;
  amountDecimal?: string;
  amountBaseUnits?: string;
  purposeMetadata?: Record<string, unknown>;
  idempotencyKey?: string;
  expiresAt?: string;
  createdAt?: string;
};

export type PaymentIntentRecord = CreateIntentInput & {
  id: string;
  status: "approved" | "rejected";
};

export type IntentCreationResult = {
  intent: PaymentIntentRecord;
  evaluation: {
    allowed: boolean;
    reasons: string[];
  };
};

export type IntentService = {
  create: (input: CreateIntentInput) => IntentCreationResult;
  get: (id: string) => PaymentIntentRecord | undefined;
  hydrate: (intents: PaymentIntentRecord[]) => void;
  list: () => PaymentIntentRecord[];
};

export const createIntentService = ({
  envelopes
}: {
  envelopes: EnvelopeStore;
}): IntentService => {
  const intents: PaymentIntentRecord[] = [];
  const nextIntentId = () =>
    `intent_${
      intents.reduce((max, intent) => {
        const parsed = Number(intent.id.replace(/^intent_/, ""));
        return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
      }, 0) + 1
    }`;

  return {
    create: (input) => {
      const evaluation = envelopes.evaluate(input.envelopeId, {
        recipientId: input.recipientId,
        amount: input.amount,
        asset: input.asset,
        executedAt: input.executedAt,
        spentToday: input.spentToday
      });

      const intent: PaymentIntentRecord = {
        ...input,
        id: nextIntentId(),
        status: evaluation.allowed ? "approved" : "rejected"
      };

      intents.push(intent);

      return {
        intent,
        evaluation
      };
    },
    get: (id) => intents.find((intent) => intent.id === id),
    hydrate(seedIntents) {
      intents.splice(0, intents.length, ...seedIntents);
    },
    list: () => [...intents]
  };
};
