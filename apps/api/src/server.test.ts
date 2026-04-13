import test from "node:test";
import assert from "node:assert/strict";

import { createApiServer } from "./server.ts";

test("api server handles recipient resolution and payment flow endpoints", async () => {
  const server = createApiServer({
    directory: {
      emails: {
        "alice@gmail.com": {
          id: "rcp_alice",
          ownerType: "user",
          ownerId: "usr_alice",
          walletAddress: "0x1111111111111111111111111111111111111111",
          claimStatus: "claimed"
        }
      }
    }
  });

  await server.start();

  try {
    const recipientResponse = await fetch(`${server.url}/recipients/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alice@gmail.com" })
    });
    const recipient = await recipientResponse.json();

    assert.equal(recipient.id, "rcp_alice");

    const paymentResponse = await fetch(`${server.url}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intentId: "intent_1",
        amount: "50.00",
        asset: "USDC",
        recipient
      })
    });
    const payment = await paymentResponse.json();

    assert.equal(payment.payment.status, "ready_for_settlement");

    const executeResponse = await fetch(
      `${server.url}/payments/${payment.payment.id}/execute`,
      {
        method: "POST"
      }
    );
    const executed = await executeResponse.json();

    assert.equal(executed.status, "settled");
  } finally {
    await server.stop();
  }
});

test("api server exposes health, listing, and async execution endpoints", async () => {
  const server = createApiServer();

  await server.start();

  try {
    const health = await fetch(`${server.url}/health`).then((response) =>
      response.json()
    );
    assert.equal(health.ok, true);

    const created = await fetch(`${server.url}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intentId: "intent_1",
        amount: "50.00",
        asset: "USDC",
        recipient: {
          id: "rcp_alice",
          ownerType: "user",
          ownerId: "usr_alice",
          walletAddress: "0x1111111111111111111111111111111111111111",
          claimStatus: "claimed",
          lookupKey: "alice@gmail.com"
        }
      })
    }).then((response) => response.json());

    const listedPayments = await fetch(`${server.url}/payments`).then((response) =>
      response.json()
    );
    assert.equal(listedPayments.length, 1);

    const executed = await fetch(
      `${server.url}/payments/${created.payment.id}/execute-async`,
      { method: "POST" }
    ).then((response) => response.json());
    assert.equal(executed.status, "queued");
    assert.equal(typeof executed.jobId, "string");

    const jobs = await fetch(`${server.url}/jobs`).then((response) =>
      response.json()
    );
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.paymentId, created.payment.id);

    const notifications = await fetch(`${server.url}/notifications`).then(
      (response) => response.json()
    );
    assert.equal(notifications.length, 1);
  } finally {
    await server.stop();
  }
});

test("api server exposes healthz and readyz endpoints", async () => {
  const server = createApiServer({
    identity: {
      repository: {
        async load() {
          return { users: [], recipients: [] };
        },
        async upsertUser() {},
        async upsertRecipient() {}
      }
    }
  });

  const originalEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    PRIVY_APP_ID: process.env.PRIVY_APP_ID,
    PRIVY_APP_SECRET: process.env.PRIVY_APP_SECRET,
    ARC_TESTNET_RPC_URL: process.env.ARC_TESTNET_RPC_URL,
    ARC_SETTLEMENT_PRIVATE_KEY: process.env.ARC_SETTLEMENT_PRIVATE_KEY
  };

  const originalFetch = globalThis.fetch;
  process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/microcosm";
  process.env.PRIVY_APP_ID = "privy-app-id";
  process.env.PRIVY_APP_SECRET = "privy-app-secret";
  process.env.ARC_TESTNET_RPC_URL = "https://rpc.testnet.arc.network";
  process.env.ARC_SETTLEMENT_PRIVATE_KEY = "0xabc";
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(server.url)) {
      return originalFetch(input as never, init);
    }

    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x4cf4e2" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  await server.start();

  try {
    const healthz = await fetch(`${server.url}/healthz`).then((response) =>
      response.json()
    );
    const readyz = await fetch(`${server.url}/readyz`).then((response) =>
      response.json()
    );

    assert.equal(Array.isArray(healthz.checks), true);
    assert.equal(Array.isArray(readyz.checks), true);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.DATABASE_URL = originalEnv.DATABASE_URL;
    process.env.PRIVY_APP_ID = originalEnv.PRIVY_APP_ID;
    process.env.PRIVY_APP_SECRET = originalEnv.PRIVY_APP_SECRET;
    process.env.ARC_TESTNET_RPC_URL = originalEnv.ARC_TESTNET_RPC_URL;
    process.env.ARC_SETTLEMENT_PRIVATE_KEY = originalEnv.ARC_SETTLEMENT_PRIVATE_KEY;
    await server.stop();
  }
});

test("api server exposes recipient get and claim endpoints", async () => {
  const server = createApiServer({
    identity: {
      repository: {
        async load() {
          return { users: [], recipients: [] };
        },
        async upsertUser() {},
        async upsertRecipient() {}
      }
    }
  });

  await server.start();

  try {
    const pending = await fetch(`${server.url}/recipients/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "claim-me@gmail.com" })
    }).then((response) => response.json());

    const fetched = await fetch(`${server.url}/recipients/${pending.id}`).then(
      (response) => response.json()
    );
    assert.equal(fetched.claimStatus, "pending-claim");

    const claimed = await fetch(`${server.url}/recipients/${pending.id}/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "claim-me@gmail.com",
        walletAddress: "0x4444444444444444444444444444444444444444",
        privyUserId: "did:privy:usr_claimed"
      })
    }).then((response) => response.json());

    assert.equal(claimed.claimStatus, "claimed");
    assert.equal(claimed.ownerId, "did:privy:usr_claimed");
  } finally {
    await server.stop();
  }
});
