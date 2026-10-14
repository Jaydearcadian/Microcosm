import test from "node:test";
import assert from "node:assert/strict";

import { createApiAppAsync } from "./index.ts";
import { getRuntimeHealth } from "./health.ts";
import { getApiRuntimeConfig } from "./runtime.ts";

const upsertById = (
  target: Array<Record<string, unknown>>,
  value: Record<string, unknown>
) => {
  const index = target.findIndex((entry) => entry.id === value.id);
  if (index === -1) {
    target.push(value);
    return;
  }
  target[index] = value;
};

test("async api app hydrates identity state from the repository and persists claims", async () => {
  const saved = {
    users: [] as Array<Record<string, unknown>>,
    recipients: [] as Array<Record<string, unknown>>
  };

  const app = await createApiAppAsync({
    identity: {
      repository: {
        async load() {
          return {
            users: [],
            recipients: []
          };
        },
        async upsertUser(user) {
          saved.users.push(user as Record<string, unknown>);
        },
        async upsertRecipient(recipient) {
          saved.recipients.push(recipient as Record<string, unknown>);
        }
      },
      provisioner: {
        async provisionUserWallet() {
          return {
            walletAddress: "0x6666666666666666666666666666666666666666",
            walletId: "wallet_1"
          };
        }
      }
    }
  });

  const pending = await app.recipients.resolve({ email: "db-user@gmail.com" });
  const claimed = await app.recipients.claim(pending.id, {
    email: "db-user@gmail.com",
    privyUserId: "did:privy:usr_db"
  });

  assert.equal(claimed.walletAddress, "0x6666666666666666666666666666666666666666");
  assert.equal(saved.users.length, 1);
  assert.equal(saved.recipients.length, 2);
});

test("async api app persists envelopes, intents, payments, and notifications through the repository", async () => {
  const saved = {
    envelopes: [] as Array<Record<string, unknown>>,
    intents: [] as Array<Record<string, unknown>>,
    payments: [] as Array<Record<string, unknown>>,
    notifications: [] as Array<Record<string, unknown>>,
    settlements: [] as Array<Record<string, unknown>>,
    ledgerEntries: [] as Array<Record<string, unknown>>,
    auditEvents: [] as Array<Record<string, unknown>>,
    workerJobs: [] as Array<Record<string, unknown>>
  };

  const app = await createApiAppAsync({
    identity: {
      repository: {
        async load() {
          return {
            users: [],
            recipients: []
          };
        },
        async loadAppState() {
          return {
            envelopes: [],
            intents: [],
            payments: [],
            notifications: [],
            settlements: [],
            ledgerEntries: [],
            auditEvents: [],
            workerJobs: []
          };
        },
        async upsertUser() {},
        async upsertRecipient() {},
        async upsertEnvelope(envelope) {
          upsertById(saved.envelopes, envelope as Record<string, unknown>);
        },
        async upsertIntent(intent) {
          upsertById(saved.intents, intent as Record<string, unknown>);
        },
        async upsertPaymentState(entry) {
          upsertById(saved.payments, {
            id: (entry as { payment: { id: string } }).payment.id,
            ...(entry as unknown as Record<string, unknown>)
          });
        },
        async upsertNotification(event) {
          upsertById(saved.notifications, event as Record<string, unknown>);
        },
        async upsertSettlement(record) {
          upsertById(saved.settlements, record as Record<string, unknown>);
        },
        async upsertLedgerEntry(entry) {
          upsertById(saved.ledgerEntries, entry as Record<string, unknown>);
        },
        async upsertAuditEvent(event) {
          upsertById(saved.auditEvents, event as Record<string, unknown>);
        },
        async upsertWorkerJob(job) {
          upsertById(saved.workerJobs, job as Record<string, unknown>);
        }
      }
    }
  });

  const envelope = await app.envelopes.create({
    id: "env_1",
    asset: "USDC",
    maxAmountPerTx: "100.00",
    maxAmountPerDay: "500.00",
    allowedRecipientIds: ["rcp_1"],
    schedule: {
      days: ["mon"],
      startHourUtc: 9,
      endHourUtc: 17
    }
  });

  const createdIntent = await app.intents.create({
    type: "send_money",
    envelopeId: envelope.id,
    recipientId: "rcp_1",
    amount: "10.00",
    asset: "USDC",
    executedAt: "2026-04-13T10:00:00.000Z",
    spentToday: "0.00"
  });

  await app.payments.create({
    intentId: createdIntent.intent.id,
    amount: "10.00",
    asset: "USDC",
    recipient: {
      id: "rcp_1",
      lookupKey: "alice@gmail.com",
      ownerType: "user",
      ownerId: "usr_1",
      walletAddress: "0x1111111111111111111111111111111111111111",
      claimStatus: "claimed"
    }
  });

  assert.equal(saved.envelopes.length, 1);
  assert.equal(saved.intents.length, 1);
  assert.equal(saved.payments.length, 1);
  assert.equal(saved.notifications.length, 1);
  assert.equal(saved.settlements.length, 1);
  assert.equal(saved.ledgerEntries.length, 1);
  assert.equal(saved.auditEvents.length, 3);
  assert.equal(saved.workerJobs.length, 0);
});

test("getApiRuntimeConfig requires database, privy, and settlement env", () => {
  const config = getApiRuntimeConfig({
    DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/microcosm",
    PRIVY_APP_ID: "privy-app-id",
    PRIVY_APP_SECRET: "privy-app-secret",
    ARC_SETTLEMENT_PRIVATE_KEY: "0xabc",
    ARC_SETTLEMENT_ROUTER_ADDRESS: "0x7777777777777777777777777777777777777777",
    ARC_CLAIM_ESCROW_ADDRESS: "0x8888888888888888888888888888888888888888",
    PORT: "4010"
  });

  assert.equal(config.port, 4010);
  assert.equal(config.databaseUrl, "postgres://postgres:postgres@127.0.0.1:5432/microcosm");
  assert.equal(
    config.arcContracts.settlementRouter,
    "0x7777777777777777777777777777777777777777"
  );
  assert.equal(
    config.arcContracts.claimEscrow,
    "0x8888888888888888888888888888888888888888"
  );
});

test("getRuntimeHealth reports degraded status when checks fail", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "unreachable" }), {
      status: 503,
      headers: { "content-type": "application/json" }
    })) as typeof fetch;

  try {
    const health = await getRuntimeHealth({
      databaseUrl: "postgres://postgres:postgres@127.0.0.1:5432/microcosm",
      arcRpcUrl: "https://rpc.testnet.arc.network",
      env: {
        PRIVY_APP_ID: "privy-app-id",
        PRIVY_APP_SECRET: "privy-app-secret"
      }
    });

    assert.equal(health.status, "degraded");
    assert.equal(health.checks.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
