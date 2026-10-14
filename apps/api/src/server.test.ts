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
    const restoreEnv = (key: string, value: string | undefined) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    };
    restoreEnv("DATABASE_URL", originalEnv.DATABASE_URL);
    restoreEnv("PRIVY_APP_ID", originalEnv.PRIVY_APP_ID);
    restoreEnv("PRIVY_APP_SECRET", originalEnv.PRIVY_APP_SECRET);
    restoreEnv("ARC_TESTNET_RPC_URL", originalEnv.ARC_TESTNET_RPC_URL);
    restoreEnv("ARC_SETTLEMENT_PRIVATE_KEY", originalEnv.ARC_SETTLEMENT_PRIVATE_KEY);
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

test("server session verification: protects routes, enforces authorization, and resolves principal", async () => {
  const { generateKeyPair, SignJWT, exportSPKI } = await import("jose");
  const { createPrivyTokenVerifier } = await import(
    "../../../packages/adapters/privy/src/index.ts"
  );

  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const { privateKey: attackerPrivateKey } = await generateKeyPair("ES256");
  const spki = await exportSPKI(publicKey);
  const appId = "cltestapp0000000000000000";

  const verifier = createPrivyTokenVerifier({
    appId,
    jwtVerificationKey: spki
  });

  const server = createApiServer({
    auth: {
      verifier,
      required: true
    }
  });

  await server.start();

  const createToken = async (opts: {
    sub?: string;
    sid?: string;
    expOffset?: number;
    aud?: string;
    key?: typeof privateKey;
  } = {}) => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ sid: opts.sid ?? "sess_valid" })
      .setProtectedHeader({ alg: "ES256", typ: "JWT" })
      .setIssuer("privy.io")
      .setAudience(opts.aud ?? appId)
      .setSubject(opts.sub ?? "did:privy:alice_user")
      .setIssuedAt(now)
      .setExpirationTime(now + (opts.expOffset ?? 3600))
      .sign(opts.key ?? privateKey);
  };

  try {
    // 1. Health endpoints remain public without auth
    const healthRes = await fetch(`${server.url}/health`);
    assert.equal(healthRes.status, 200);

    // 2. Protected route rejects missing authorization header
    const noAuthRes = await fetch(`${server.url}/v1/me`);
    assert.equal(noAuthRes.status, 401);
    const noAuthJson = await noAuthRes.json();
    assert.equal(noAuthJson.error, "unauthorized");

    // 3. Protected route rejects malformed authorization header
    const badAuthRes = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: "Basic foobar" }
    });
    assert.equal(badAuthRes.status, 401);
    const badAuthJson = await badAuthRes.json();
    assert.equal(badAuthJson.error, "invalid_token");

    // 4. Protected route rejects expired token
    const expiredToken = await createToken({ expOffset: -3600 });
    const expiredRes = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: `Bearer ${expiredToken}` }
    });
    assert.equal(expiredRes.status, 401);
    const expiredJson = await expiredRes.json();
    assert.equal(expiredJson.error, "token_expired");

    // 5. Protected route rejects invalid signature
    const invalidSigToken = await createToken({ key: attackerPrivateKey });
    const invalidSigRes = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: `Bearer ${invalidSigToken}` }
    });
    assert.equal(invalidSigRes.status, 401);

    // 6. Valid token successfully returns /v1/me with canonical principal and personal space
    const validToken = await createToken({ sub: "did:privy:alice_user" });
    const meRes = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: `Bearer ${validToken}` }
    });
    assert.equal(meRes.status, 200);
    const me = await meRes.json();
    assert.ok(me.principal.id.startsWith("usr_"));
    assert.equal(me.principal.privyUserId, "did:privy:alice_user");
    assert.ok(me.activeSpace.id.startsWith("spc_"));
    assert.equal(me.activeSpace.ownerUserId, me.principal.id);

    // 7. Repeated request resolves to identical principal ID and space ID
    const meRes2 = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: `Bearer ${validToken}` }
    });
    const me2 = await meRes2.json();
    assert.equal(me2.principal.id, me.principal.id);
    assert.equal(me2.activeSpace.id, me.activeSpace.id);

    // 8. Reject client-supplied conflicting principal ID in request header
    const spoofHeaderRes = await fetch(`${server.url}/v1/me`, {
      headers: {
        authorization: `Bearer ${validToken}`,
        "x-principal-id": "usr_victim_spoof"
      }
    });
    assert.equal(spoofHeaderRes.status, 403);
    const spoofHeaderJson = await spoofHeaderRes.json();
    assert.equal(spoofHeaderJson.error, "identity_mismatch");

    // 9. Reject client-supplied conflicting principal ID in mutation request body
    const spoofBodyRes = await fetch(`${server.url}/envelopes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${validToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        userId: "usr_victim_spoof",
        name: "test-envelope"
      })
    });
    assert.equal(spoofBodyRes.status, 403);
    const spoofBodyJson = await spoofBodyRes.json();
    assert.equal(spoofBodyJson.error, "identity_mismatch");

    // 10. Cross-space unauthorized access returns 404 without leaking other spaces
    const bobToken = await createToken({ sub: "did:privy:bob_user" });
    const bobMeRes = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    const bobMe = await bobMeRes.json();
    assert.notEqual(bobMe.principal.id, me.principal.id);
    assert.notEqual(bobMe.activeSpace.id, me.activeSpace.id);

    // Alice attempts to access Bob's space via /v1/spaces/:id
    const crossSpaceRes = await fetch(`${server.url}/v1/spaces/${bobMe.activeSpace.id}`, {
      headers: { authorization: `Bearer ${validToken}` }
    });
    assert.equal(crossSpaceRes.status, 404);
    const crossSpaceJson = await crossSpaceRes.json();
    assert.equal(crossSpaceJson.error, "space_not_found");

    // Alice accesses her own space
    const ownSpaceRes = await fetch(`${server.url}/v1/spaces/${me.activeSpace.id}`, {
      headers: { authorization: `Bearer ${validToken}` }
    });
    assert.equal(ownSpaceRes.status, 200);
    const ownSpaceJson = await ownSpaceRes.json();
    assert.equal(ownSpaceJson.id, me.activeSpace.id);
  } finally {
    await server.stop();
  }
});

