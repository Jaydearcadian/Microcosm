import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT, exportSPKI } from "jose";
import { createApiServer } from "./server.ts";
import { createPrivyTokenVerifier } from "../../../packages/adapters/privy/src/index.ts";

test("Task 6: Centralized /v1 route dispatcher and tenant authorization", async () => {
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

  const makeToken = async (opts: {
    sub: string;
    sid?: string;
    key?: typeof privateKey;
    expOffset?: number;
  }) => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ sid: opts.sid ?? "sess_123" })
      .setProtectedHeader({ alg: "ES256", typ: "JWT" })
      .setIssuer("privy.io")
      .setAudience(appId)
      .setSubject(opts.sub)
      .setIssuedAt(now)
      .setExpirationTime(now + (opts.expOffset ?? 3600))
      .sign(opts.key ?? privateKey);
  };

  const aliceToken = await makeToken({ sub: "did:privy:alice" });
  const bobToken = await makeToken({ sub: "did:privy:bob" });

  try {
    // =========================================================================
    // Gate 1: Route coverage, HTTP method validation, and error envelopes
    // =========================================================================

    // 1.1 Public health endpoints remain public
    const health = await fetch(`${server.url}/health`).then((r) => r.json());
    assert.equal(health.ok, true);

    // 1.2 Unknown /v1 routes return 404 route_not_found with standard envelope
    const unknownRes = await fetch(`${server.url}/v1/unknown_endpoint`, {
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(unknownRes.status, 404);
    const unknownJson = await unknownRes.json();
    assert.equal(unknownJson.error, "route_not_found");
    assert.equal(unknownJson.code, "route_not_found");
    assert.ok(typeof unknownJson.requestId === "string");

    // 1.3 Unsupported HTTP method on recognized routes returns 405 Method Not Allowed + Allow header
    const notAllowedRes = await fetch(`${server.url}/v1/me`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(notAllowedRes.status, 405);
    assert.equal(notAllowedRes.headers.get("allow"), "GET");
    const notAllowedJson = await notAllowedRes.json();
    assert.equal(notAllowedJson.error, "method_not_allowed");
    assert.equal(notAllowedJson.code, "method_not_allowed");
    assert.ok(typeof notAllowedJson.requestId === "string");

    const methodNotAllowedBalance = await fetch(`${server.url}/v1/balance`, {
      method: "POST",
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(methodNotAllowedBalance.status, 405);
    assert.equal(methodNotAllowedBalance.headers.get("allow"), "GET");

    // 1.4 Oversized body returns 413 payload_too_large
    const largeBody = "a".repeat(110 * 1024); // > 100KB
    const oversizedRes = await fetch(`${server.url}/v1/recipients`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ padding: largeBody })
    });
    assert.equal(oversizedRes.status, 413);
    const oversizedJson = await oversizedRes.json();
    assert.equal(oversizedJson.error, "payload_too_large");

    // 1.5 Malformed JSON returns 400 invalid_json
    const malformedRes = await fetch(`${server.url}/v1/recipients`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: "{ not: valid json ... "
    });
    assert.equal(malformedRes.status, 400);
    const malformedJson = await malformedRes.json();
    assert.equal(malformedJson.error, "invalid_json");

    // =========================================================================
    // Gate 2: Caller-controlled ownership rejection
    // =========================================================================

    // 2.1 Reject spoofed top-level userId conflicting with verified session
    const spoofUserIdRes = await fetch(`${server.url}/v1/recipients`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        userId: "usr_victim_bob",
        displayLabel: "Attacker Recipient",
        address: "0x1111111111111111111111111111111111111111"
      })
    });
    assert.equal(spoofUserIdRes.status, 403);
    const spoofUserIdJson = await spoofUserIdRes.json();
    assert.equal(spoofUserIdJson.error, "identity_mismatch");

    // 2.2 Reject spoofed top-level ownerUserId conflicting with verified session
    const spoofOwnerIdRes = await fetch(`${server.url}/v1/envelopes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ownerUserId: "usr_victim_bob",
        asset: "USDC",
        maxAmountPerTx: "100.00",
        maxAmountPerDay: "1000.00",
        allowedRecipientIds: [],
        schedule: { days: ["mon", "tue", "wed", "thu", "fri"], startHourUtc: 9, endHourUtc: 17 }
      })
    });
    assert.equal(spoofOwnerIdRes.status, 403);
    const spoofOwnerIdJson = await spoofOwnerIdRes.json();
    assert.equal(spoofOwnerIdJson.error, "identity_mismatch");

    // 2.3 Reject nested spoofed ownership inside body (e.g. metadata.principalId)
    const spoofNestedRes = await fetch(`${server.url}/v1/recipients`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        displayLabel: "Attacker Recipient",
        address: "0x1111111111111111111111111111111111111111",
        metadata: {
          delegation: {
            principalId: "usr_victim_bob"
          }
        }
      })
    });
    assert.equal(spoofNestedRes.status, 403);
    const spoofNestedJson = await spoofNestedRes.json();
    assert.equal(spoofNestedJson.error, "identity_mismatch");

    // 2.4 Reject spoofed x-principal-id header
    const spoofHeaderRes = await fetch(`${server.url}/v1/me`, {
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "x-principal-id": "usr_victim_bob"
      }
    });
    assert.equal(spoofHeaderRes.status, 403);
    assert.equal((await spoofHeaderRes.json()).error, "identity_mismatch");

    // =========================================================================
    // Gate 3: Tenant isolation and Space boundary enforcement
    // =========================================================================

    // Setup Alice's context and resources
    const aliceMeRes = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(aliceMeRes.status, 200);
    const aliceMe = await aliceMeRes.json();
    const aliceSpaceId = aliceMe.activeSpace.id;
    const aliceUserId = aliceMe.principal.id;

    // Setup Bob's context and resources
    const bobMeRes = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    assert.equal(bobMeRes.status, 200);
    const bobMe = await bobMeRes.json();
    const bobSpaceId = bobMe.activeSpace.id;
    const bobUserId = bobMe.principal.id;

    assert.notEqual(aliceSpaceId, bobSpaceId);
    assert.notEqual(aliceUserId, bobUserId);

    // 3.1 Bob cannot discover Alice's space via /v1/spaces/:id (returns 404 non-leaking)
    const bobAccessAliceSpace = await fetch(`${server.url}/v1/spaces/${aliceSpaceId}`, {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    assert.equal(bobAccessAliceSpace.status, 404);
    assert.equal((await bobAccessAliceSpace.json()).error, "space_not_found");

    // 3.2 Bob passing Alice's spaceId in x-space-id returns 404 space_not_found
    const bobSpoofSpaceHeader = await fetch(`${server.url}/v1/me`, {
      headers: {
        authorization: `Bearer ${bobToken}`,
        "x-space-id": aliceSpaceId
      }
    });
    assert.equal(bobSpoofSpaceHeader.status, 404);
    assert.equal((await bobSpoofSpaceHeader.json()).error, "space_not_found");

    // 3.3 Alice creates an envelope in her space
    const aliceEnvRes = await fetch(`${server.url}/v1/envelopes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: "env_alice_payroll",
        asset: "USDC",
        maxAmountPerTx: "500.00",
        maxAmountPerDay: "5000.00",
        allowedRecipientIds: ["rcp_alice_carol"],
        schedule: { days: ["mon", "tue", "wed", "thu", "fri"], startHourUtc: 0, endHourUtc: 24 }
      })
    });
    assert.equal(aliceEnvRes.status, 201);
    const aliceEnv = await aliceEnvRes.json();
    assert.equal(aliceEnv.id, "env_alice_payroll");
    assert.equal(aliceEnv.spaceId, aliceSpaceId);
    assert.equal(aliceEnv.ownerUserId, aliceUserId);

    // 3.4 Bob cannot read Alice's envelope -> 404 envelope_not_found
    const bobReadAliceEnv = await fetch(`${server.url}/v1/envelopes/env_alice_payroll`, {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    assert.equal(bobReadAliceEnv.status, 404);
    assert.equal((await bobReadAliceEnv.json()).error, "envelope_not_found");

    // 3.5 Alice creates a recipient in her space
    const aliceRcpRes = await fetch(`${server.url}/v1/recipients`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        recipientType: "wallet",
        displayLabel: "Carol",
        address: "0x2222222222222222222222222222222222222222"
      })
    });
    assert.equal(aliceRcpRes.status, 201);
    const aliceRcp = (await aliceRcpRes.json()).recipient;
    assert.equal(aliceRcp.spaceId, aliceSpaceId);

    // 3.6 Bob cannot read Alice's recipient -> 404 recipient_not_found
    const bobReadAliceRcp = await fetch(`${server.url}/v1/recipients/${aliceRcp.id}`, {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    assert.equal(bobReadAliceRcp.status, 404);
    assert.equal((await bobReadAliceRcp.json()).error, "recipient_not_found");

    // 3.7 Cross-tenant nested resource reference: Bob tries to create an intent in his space referencing Alice's envelope
    const bobCrossEnvIntent = await fetch(`${server.url}/v1/intents`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: "send_money",
        envelopeId: "env_alice_payroll", // Cross-tenant reference!
        recipientId: "rcp_bob_dummy",
        amount: "50.00",
        asset: "USDC",
        executedAt: new Date().toISOString(),
        spentToday: "0.00"
      })
    });
    assert.equal(bobCrossEnvIntent.status, 404);
    assert.equal((await bobCrossEnvIntent.json()).error, "envelope_not_found");

    // 3.8 Cross-tenant nested resource reference: Bob creates an envelope in his space, but references Alice's recipient
    const bobEnvRes = await fetch(`${server.url}/v1/envelopes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: "env_bob_personal",
        asset: "USDC",
        maxAmountPerTx: "100.00",
        maxAmountPerDay: "1000.00",
        allowedRecipientIds: [aliceRcp.id],
        schedule: { days: ["mon", "tue", "wed", "thu", "fri"], startHourUtc: 0, endHourUtc: 24 }
      })
    });
    assert.equal(bobEnvRes.status, 201);

    const bobCrossRcpIntent = await fetch(`${server.url}/v1/intents`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: "send_money",
        envelopeId: "env_bob_personal",
        recipientId: aliceRcp.id, // Alice's recipient in Bob's space!
        amount: "50.00",
        asset: "USDC",
        executedAt: new Date().toISOString(),
        spentToday: "0.00"
      })
    });
    assert.equal(bobCrossRcpIntent.status, 404);
    assert.equal((await bobCrossRcpIntent.json()).error, "recipient_not_found");

    // =========================================================================
    // Gate 4: Payment stage separation and role authorization
    // =========================================================================

    // Alice creates a valid intent in her space
    const aliceIntentRes = await fetch(`${server.url}/v1/intents`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: "send_money",
        envelopeId: "env_alice_payroll",
        recipientId: aliceRcp.id,
        amount: "50.00",
        asset: "USDC",
        executedAt: new Date().toISOString(),
        spentToday: "0.00"
      })
    });
    assert.equal(aliceIntentRes.status, 201);
    const aliceIntent = (await aliceIntentRes.json()).intent;

    // 4.1 Payment preparation is strictly decoupled from payment execution
    const prepRes = await fetch(`${server.url}/v1/payments/prepare`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        intentId: aliceIntent.id
      })
    });
    assert.equal(prepRes.status, 200);
    const prep = await prepRes.json();
    assert.equal(prep.intentId, aliceIntent.id);
    assert.equal(prep.value, "0"); // zero native ETH transfer
    assert.ok(prep.calldata.startsWith("0x"));

    // Ensure preparation did not execute or create payment
    const paymentsListBefore = await fetch(`${server.url}/v1/payments`, {
      headers: { authorization: `Bearer ${aliceToken}` }
    }).then((r) => r.json());
    assert.equal(paymentsListBefore.length, 0);

    // 4.2 Bob cannot prepare or access Alice's intent -> 404 intent_not_found
    const bobPrepAliceIntent = await fetch(`${server.url}/v1/payments/prepare`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        intentId: aliceIntent.id
      })
    });
    assert.equal(bobPrepAliceIntent.status, 404);
    assert.equal((await bobPrepAliceIntent.json()).error, "intent_not_found");

    // 4.3 Create payment for Alice
    const alicePaymentRes = await fetch(`${server.url}/v1/payments`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        intentId: aliceIntent.id,
        amount: "50.00",
        asset: "USDC",
        recipient: aliceRcp
      })
    });
    assert.equal(alicePaymentRes.status, 201);
    const alicePayment = (await alicePaymentRes.json()).payment;
    assert.equal(alicePayment.spaceId, aliceSpaceId);

    // 4.4 Bob cannot read or execute Alice's payment
    const bobReadPayment = await fetch(`${server.url}/v1/payments/${alicePayment.id}`, {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    assert.equal(bobReadPayment.status, 404);
    assert.equal((await bobReadPayment.json()).error, "payment_not_found");

    const bobExecPayment = await fetch(
      `${server.url}/v1/payments/${alicePayment.id}/execute`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${bobToken}` }
      }
    );
    assert.equal(bobExecPayment.status, 404);
    assert.equal((await bobExecPayment.json()).error, "payment_not_found");

    // 4.5 Non-owner attempting owner-only operation: Bob attempts to delete Alice's space
    const bobDeleteAliceSpace = await fetch(`${server.url}/v1/spaces/${aliceSpaceId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${bobToken}` }
    });
    // Bob has no membership in Alice's space -> 404 space_not_found (non-leaking)
    assert.equal(bobDeleteAliceSpace.status, 404);

    // Now test a member in the same space with a non-owner role attempting an owner-only action
    const app = await server.app;
    await app.spaces.addMember?.({
      spaceId: aliceSpaceId,
      userId: bobUserId,
      role: "viewer"
    });

    // Bob is now a viewer in Alice's space. Bob requests DELETE /v1/spaces/:id for Alice's space
    const bobViewerDelete = await fetch(`${server.url}/v1/spaces/${aliceSpaceId}`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "x-space-id": aliceSpaceId
      }
    });
    assert.equal(bobViewerDelete.status, 403);
    const bobViewerJson = await bobViewerDelete.json();
    assert.equal(bobViewerJson.error, "forbidden");

    // Viewer attempting mutation (POST /v1/payments/:id/execute)
    const bobViewerExec = await fetch(
      `${server.url}/v1/payments/${alicePayment.id}/execute`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${bobToken}`,
          "x-space-id": aliceSpaceId
        }
      }
    );
    assert.equal(bobViewerExec.status, 403);
    assert.equal((await bobViewerExec.json()).error, "forbidden");

    // Revoke Bob's membership in Alice's space
    await app.spaces.revokeMembership(bobUserId, aliceSpaceId);
    const bobRevokedAccess = await fetch(`${server.url}/v1/spaces/${aliceSpaceId}`, {
      headers: {
        authorization: `Bearer ${bobToken}`,
        "x-space-id": aliceSpaceId
      }
    });
    assert.equal(bobRevokedAccess.status, 403);
    assert.equal((await bobRevokedAccess.json()).error, "forbidden");

    // =========================================================================
    // Gate 5: Balance, Wallet, and Activity Scoping
    // =========================================================================

    const balanceRes = await fetch(`${server.url}/v1/balance`, {
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(balanceRes.status, 200);
    const balance = await balanceRes.json();
    assert.equal(balance.spaceId, aliceSpaceId);
    assert.equal(balance.asset, "USDC");

    const walletRes = await fetch(`${server.url}/v1/wallet`, {
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(walletRes.status, 200);
    const wallet = await walletRes.json();
    assert.ok(Array.isArray(wallet.wallets));

    const activityRes = await fetch(`${server.url}/v1/activity`, {
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(activityRes.status, 200);
    const activity = await activityRes.json();
    assert.ok(Array.isArray(activity.items));
  } finally {
    await server.stop();
  }
});
