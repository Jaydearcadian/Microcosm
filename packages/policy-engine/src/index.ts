export type Envelope = {
  id: string;
  asset: string;
  maxAmountPerTx: string;
  maxAmountPerDay: string;
  allowedRecipientIds: readonly string[];
  schedule: {
    days: readonly string[];
    startHourUtc: number;
    endHourUtc: number;
  };
  name?: string;
  spaceId?: string;
  ownerUserId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PaymentIntent = {
  recipientId: string;
  amount: string;
  asset: string;
  executedAt: string;
  spentToday: string;
};

export type PolicyEvaluation = {
  allowed: boolean;
  reasons: string[];
};

const toCents = (amount: string): number => Math.round(Number(amount) * 100);

const weekday = (value: Date): string =>
  value.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toLowerCase();

export const evaluateEnvelope = (
  envelope: Envelope,
  intent: PaymentIntent
): PolicyEvaluation => {
  const reasons: string[] = [];

  if (intent.asset !== envelope.asset) {
    reasons.push(`Asset mismatch: expected ${envelope.asset}`);
  }

  if (!envelope.allowedRecipientIds.includes(intent.recipientId)) {
    reasons.push("Recipient is not allowed by this envelope");
  }

  if (toCents(intent.amount) > toCents(envelope.maxAmountPerTx)) {
    reasons.push("Intent exceeds the per-transaction limit");
  }

  if (toCents(intent.spentToday) + toCents(intent.amount) > toCents(envelope.maxAmountPerDay)) {
    reasons.push("Intent exceeds the daily limit");
  }

  const executedAt = new Date(intent.executedAt);
  const day = weekday(executedAt);
  const hour = executedAt.getUTCHours();

  if (!envelope.schedule.days.includes(day)) {
    reasons.push("Intent falls outside the allowed schedule days");
  }

  if (hour < envelope.schedule.startHourUtc || hour >= envelope.schedule.endHourUtc) {
    reasons.push("Intent falls outside the allowed schedule hours");
  }

  return {
    allowed: reasons.length === 0,
    reasons
  };
};
