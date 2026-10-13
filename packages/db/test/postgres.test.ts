import test from "node:test";
import assert from "node:assert/strict";

import {
  createPostgresAppRepository,
  createPostgresIdentityRepository,
  type SqlClient
} from "../src/postgres.ts";

test("postgres identity repository hydrates users and recipients from query results", async () => {
  const client: SqlClient = {
    async query(sql) {
      if (sql.includes("from users")) {
        return {
          rows: [
            {
              id: "usr_1",
              email: "alice@gmail.com",
              privy_user_id: "did:privy:usr_1",
              wallet_address: "0x1111111111111111111111111111111111111111"
            }
          ]
        };
      }

      return {
        rows: [
          {
            id: "rcp_1",
            lookup_key: "alice@gmail.com",
            owner_type: "user",
            owner_id: "did:privy:usr_1",
            wallet_address: "0x1111111111111111111111111111111111111111",
            claim_status: "claimed"
          }
        ]
      };
    }
  };

  const repository = createPostgresIdentityRepository({ client });
  const state = await repository.load();

  assert.equal(state.users.length, 1);
  assert.equal(state.recipients.length, 1);
  assert.equal(state.users[0]?.email, "alice@gmail.com");
  assert.equal(state.recipients[0]?.lookupKey, "alice@gmail.com");
});

test("postgres identity repository upserts users and recipients", async () => {
  const calls: string[] = [];
  const client: SqlClient = {
    async query(sql) {
      calls.push(sql);
      return { rows: [] };
    }
  };

  const repository = createPostgresIdentityRepository({ client });

  await repository.upsertUser({
    id: "usr_1",
    email: "alice@gmail.com",
    privyUserId: "did:privy:usr_1",
    walletAddress: "0x1111111111111111111111111111111111111111"
  });
  await repository.upsertRecipient({
    id: "rcp_1",
    lookupKey: "alice@gmail.com",
    ownerType: "user",
    ownerId: "did:privy:usr_1",
    walletAddress: "0x1111111111111111111111111111111111111111",
    claimStatus: "claimed"
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0] ?? "", /insert into users/i);
  assert.match(calls[1] ?? "", /insert into recipients/i);
});

test("postgres app repository hydrates envelopes, intents, payments, and notifications", async () => {
  const client: SqlClient = {
    async query(sql) {
      if (sql.includes("from users")) return { rows: [] };
      if (sql.includes("from recipients")) return { rows: [] };
      if (sql.includes("from envelopes")) {
        return {
          rows: [
            {
              data: JSON.stringify({
                id: "env_1",
                asset: "USDC",
                maxAmountPerTx: "100",
                maxAmountPerDay: "500",
                allowedRecipientIds: ["rcp_1"],
                schedule: {
                  days: ["mon"],
                  startHourUtc: 9,
                  endHourUtc: 17
                }
              })
            }
          ]
        };
      }
      if (sql.includes("from intents")) {
        return {
          rows: [
            {
              data: JSON.stringify({
                id: "intent_1",
                type: "send_money",
                envelopeId: "env_1",
                recipientId: "rcp_1",
                amount: "10",
                asset: "USDC",
                executedAt: "2026-04-13T10:00:00.000Z",
                spentToday: "0",
                status: "approved"
              })
            }
          ]
        };
      }
      if (sql.includes("from payments")) {
        return {
          rows: [
            {
              payment_data: JSON.stringify({
                id: "pay_1",
                intentId: "intent_1",
                amount: "10",
                asset: "USDC",
                recipientId: "rcp_1",
                status: "ready_for_settlement"
              }),
              settlement_data: JSON.stringify({
                mode: "direct",
                paymentId: "pay_1",
                amount: "10",
                asset: "USDC",
                destination: "0x1111111111111111111111111111111111111111"
              })
            }
          ]
        };
      }

      if (sql.includes("from settlements")) {
        return {
          rows: [
            {
              data: JSON.stringify({
                id: "stl_pay_1",
                paymentId: "pay_1",
                chain: "arc",
                mode: "direct",
                status: "planned",
                amount: "10",
                asset: "USDC",
                destination: "0x1111111111111111111111111111111111111111"
              })
            }
          ]
        };
      }

      if (sql.includes("from ledger_entries")) {
        return {
          rows: [
            {
              data: JSON.stringify({
                id: "led_1",
                accountId: "recipient:rcp_1",
                entryType: "liability_hold",
                asset: "USDC",
                amount: "10",
                referenceType: "payment",
                referenceId: "pay_1"
              })
            }
          ]
        };
      }

      if (sql.includes("from audit_events")) {
        return {
          rows: [
            {
              data: JSON.stringify({
                id: "aud_1",
                actorType: "system",
                actorId: "api",
                eventType: "payment.created",
                objectType: "payment",
                objectId: "pay_1",
                payload: { amount: "10" }
              })
            }
          ]
        };
      }

      if (sql.includes("from worker_jobs")) {
        return {
          rows: [
            {
              data: JSON.stringify({
                id: "job_pay_1",
                type: "settlement.execute",
                paymentId: "pay_1",
                settlementId: "stl_pay_1",
                status: "queued"
              })
            }
          ]
        };
      }

      return {
        rows: [
          {
            data: JSON.stringify({
              id: "ntf_1",
              type: "payment.created",
              channel: "email",
              recipient: "alice@gmail.com",
              payload: { paymentId: "pay_1" }
            })
          }
        ]
      };
    }
  };

  const repository = createPostgresAppRepository({ client });
  const state = await repository.loadAppState();

  assert.equal(state.envelopes.length, 1);
  assert.equal(state.intents.length, 1);
  assert.equal(state.payments.length, 1);
  assert.equal(state.notifications.length, 1);
  assert.equal(state.settlements.length, 1);
  assert.equal(state.ledgerEntries.length, 1);
  assert.equal(state.auditEvents.length, 1);
  assert.equal(state.workerJobs.length, 1);
  assert.equal(state.payments[0]?.payment.id, "pay_1");
});

test("postgres app repository upserts envelopes, intents, payments, and notifications", async () => {
  const calls: string[] = [];
  const client: SqlClient = {
    async query(sql) {
      calls.push(sql);
      return { rows: [] };
    }
  };

  const repository = createPostgresAppRepository({ client });

  await repository.upsertEnvelope({
    id: "env_1",
    asset: "USDC",
    maxAmountPerTx: "100",
    maxAmountPerDay: "500",
    allowedRecipientIds: ["rcp_1"],
    schedule: {
      days: ["mon"],
      startHourUtc: 9,
      endHourUtc: 17
    }
  });
  await repository.upsertIntent({
    id: "intent_1",
    type: "send_money",
    envelopeId: "env_1",
    recipientId: "rcp_1",
    amount: "10",
    asset: "USDC",
    executedAt: "2026-04-13T10:00:00.000Z",
    spentToday: "0",
    status: "approved"
  });
  await repository.upsertPaymentState({
    payment: {
      id: "pay_1",
      intentId: "intent_1",
      amount: "10",
      asset: "USDC",
      recipientId: "rcp_1",
      status: "ready_for_settlement"
    },
    settlement: {
      chain: "arc",
      mode: "direct",
      paymentId: "pay_1",
      amount: "10",
      asset: "USDC",
      destination: "0x1111111111111111111111111111111111111111"
    }
  });
  await repository.upsertNotification({
    id: "ntf_1",
    type: "payment.created",
    channel: "email",
    recipient: "alice@gmail.com",
    payload: { paymentId: "pay_1" }
  });
  await repository.upsertSettlement({
    id: "stl_pay_1",
    paymentId: "pay_1",
    chain: "arc",
    mode: "direct",
    status: "planned",
    amount: "10",
    asset: "USDC",
    destination: "0x1111111111111111111111111111111111111111"
  });
  await repository.upsertLedgerEntry({
    id: "led_1",
    accountId: "recipient:rcp_1",
    entryType: "liability_hold",
    asset: "USDC",
    amount: "10",
    referenceType: "payment",
    referenceId: "pay_1"
  });
  await repository.upsertAuditEvent({
    id: "aud_1",
    actorType: "system",
    actorId: "api",
    eventType: "payment.created",
    objectType: "payment",
    objectId: "pay_1",
    payload: { amount: "10" }
  });
  await repository.upsertWorkerJob({
    id: "job_pay_1",
    type: "settlement.execute",
    paymentId: "pay_1",
    settlementId: "stl_pay_1",
    status: "queued"
  });

  assert.equal(calls.length, 8);
  assert.match(calls[0] ?? "", /insert into envelopes/i);
  assert.match(calls[1] ?? "", /insert into intents/i);
  assert.match(calls[2] ?? "", /insert into payments/i);
  assert.match(calls[3] ?? "", /insert into notifications/i);
  assert.match(calls[4] ?? "", /insert into settlements/i);
  assert.match(calls[5] ?? "", /insert into ledger_entries/i);
  assert.match(calls[6] ?? "", /insert into audit_events/i);
  assert.match(calls[7] ?? "", /insert into worker_jobs/i);
});
