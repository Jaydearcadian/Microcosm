import {
  evaluateEnvelope,
  type Envelope,
  type PaymentIntent,
  type PolicyEvaluation
} from "../../policy-engine/src/index.ts";

export type EnvelopeStore = {
  create: (envelope: Envelope) => Envelope;
  get: (id: string) => Envelope | undefined;
  hydrate: (envelopes: Envelope[]) => void;
  list: () => Envelope[];
  evaluate: (id: string, intent: PaymentIntent) => PolicyEvaluation;
};

export const createEnvelopeStore = (): EnvelopeStore => {
  const envelopes = new Map<string, Envelope>();

  return {
    create: (envelope) => {
      envelopes.set(envelope.id, envelope);
      return envelope;
    },
    get: (id) => envelopes.get(id),
    hydrate(seedEnvelopes) {
      envelopes.clear();
      seedEnvelopes.forEach((envelope) => {
        envelopes.set(envelope.id, envelope);
      });
    },
    list: () => [...envelopes.values()],
    evaluate: (id, intent) => {
      const envelope = envelopes.get(id);

      if (!envelope) {
        throw new Error(`Unknown envelope: ${id}`);
      }

      return evaluateEnvelope(envelope, intent);
    }
  };
};
