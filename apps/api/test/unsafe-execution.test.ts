import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT, exportSPKI } from "jose";
import { createApiServer } from "../src/server.ts";
import { createPrivyTokenVerifier } from "../../../packages/adapters/privy/src/index.ts";

test("Task 8: Remove Unsafe Server-Signed Consumer Execution & Enforce Intent-Bound Lifecycle", async () => {
  // Ensure ARC_SETTLEMENT_PRIVATE_KEY is unset to verify server startup without it
  const origKey = process.env.ARC_SETTLEMENT_PRIVATE_KEY;
  delete process.env.ARC_SETTLEMENT_PRIVATE_KEY;

  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const spki = await exportSPKI(publicKey);
  const appId = "cltestapp_task8_000000";

  const verifier = createPrivyTokenVerifier({
    appId,
    jwtVerificationKey: spki
  });

  const server = createApiServer({
    auth: {
      verifier,
      required: true
    },
    settlement: {
      confirmer: async () => ({
        confirmed: true,
        checkedAt: new Date().toISOString()
      })
    }
  });

  await server.start();

  const makeToken = async (sub: string) => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ sid: `sess_${sub}` })
      .setProtectedHeader({ alg: "ES256", typ: "JWT" })
      .setIssuer("privy.io")
      .setAudience(appId)
      .setSubject(sub)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);
  };

  const aliceToken = await makeToken("did:privy:alice_task8");
  const bobToken = await makeToken("did:privy:bob_task8");

  try {
    // -------------------------------------------------------------------------
    // 1. Startup Independence: Server starts cleanly without ARC_SETTLEMENT_PRIVATE_KEY
    // -------------------------------------------------------------------------
    const healthRes = await fetch(`${server.url}/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.ok, true);

    // Bootstrap Alice and Bob context
    const aliceMe = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: `Bearer ${aliceToken}` }
    }).then((r) => r.json());
    const aliceSpaceId = aliceMe.activeSpace.id;

    const bobMe = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: `Bearer ${bobToken}` }
    }).then((r) => r.json());
    const bobSpaceId = bobMe.activeSpace.id;

    // Alice creates an envelope and recipient
    const aliceEnv = await fetch(`${server.url}/v1/envelopes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: "env_task8_payroll",
        asset: "USDC",
        maxAmountPerTx: "100.00",
        maxAmountPerDay: "1000.00",
        allowedRecipientIds: ["rcp_task8_carol"],
        schedule: { days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], startHourUtc: 0, endHourUtc: 24 }
      })
    }).then((r) => r.json());

    const aliceRcp = (
      await fetch(`${server.url}/v1/recipients`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${aliceToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          id: "rcp_task8_carol",
          recipientType: "wallet",
          displayLabel: "Carol",
          address: "0x3333333333333333333333333333333333333333"
        })
      }).then((r) => r.json())
    ).recipient;

    // Alice creates an approved intent within envelope limits
    const approvedIntentRes = await fetch(`${server.url}/v1/intents`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: "send_money",
        envelopeId: aliceEnv.id,
        recipientId: aliceRcp.id,
        amount: "50.00",
        asset: "USDC",
        executedAt: new Date().toISOString(),
        spentToday: "0.00"
      })
    });
    assert.equal(approvedIntentRes.status, 201);
    const approvedIntent = (await approvedIntentRes.json()).intent;
    assert.equal(approvedIntent.status, "approved");

    // Alice creates an intent exceeding envelope limit -> status: rejected
    const rejectedIntentRes = await fetch(`${server.url}/v1/intents`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: "send_money",
        envelopeId: aliceEnv.id,
        recipientId: aliceRcp.id,
        amount: "500.00", // exceeds maxAmountPerTx: 100.00
        asset: "USDC",
        executedAt: new Date().toISOString(),
        spentToday: "0.00"
      })
    });
    assert.equal(rejectedIntentRes.status, 201);
    const rejectedIntent = (await rejectedIntentRes.json()).intent;
    assert.equal(rejectedIntent.status, "rejected");

    // -------------------------------------------------------------------------
    // 2. Reject payment preparation and creation for unapproved intents
    // -------------------------------------------------------------------------
    const prepRejected = await fetch(`${server.url}/v1/payments/prepare`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ intentId: rejectedIntent.id })
    });
    assert.equal(prepRejected.status, 400);
    const prepRejectedBody = await prepRejected.json();
    assert.equal(prepRejectedBody.error, "intent_not_approved");

    const createRejected = await fetch(`${server.url}/v1/payments`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ intentId: rejectedIntent.id, amount: "500.00", asset: "USDC" })
    });
    assert.equal(createRejected.status, 400);
    assert.equal((await createRejected.json()).error, "intent_not_approved");

    // -------------------------------------------------------------------------
    // 3. Preparation binds to approved intent and generates unsigned calldata
    // -------------------------------------------------------------------------
    const prepApproved = await fetch(`${server.url}/v1/payments/prepare`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ intentId: approvedIntent.id })
    });
    assert.equal(prepApproved.status, 200);
    const prepData = await prepApproved.json();
    assert.equal(prepData.intentId, approvedIntent.id);
    assert.equal(prepData.value, "0"); // zero native Arc/ETH transfer
    assert.match(prepData.calldata, /^0xa9059cbb/); // standard ERC20 transfer selector
    assert.equal(prepData.chainId, 5042);
    assert.equal(prepData.amountBaseUnits, "50000000"); // 50.00 USDC in 6 decimals

    // -------------------------------------------------------------------------
    // 4. Cross-Tenant Intent/Payment Isolation: Bob cannot access Alice's intent
    // -------------------------------------------------------------------------
    const bobPrepAlice = await fetch(`${server.url}/v1/payments/prepare`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ intentId: approvedIntent.id })
    });
    assert.equal(bobPrepAlice.status, 404);
    assert.equal((await bobPrepAlice.json()).error, "intent_not_found");

    const bobSubmitAlice = await fetch(`${server.url}/v1/payments/submission`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        intentId: approvedIntent.id,
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111"
      })
    });
    assert.equal(bobSubmitAlice.status, 404);
    assert.equal((await bobSubmitAlice.json()).error, "intent_not_found");

    // -------------------------------------------------------------------------
    // 5. Block server-signed consumer execution endpoints with 403 server_signing_disallowed
    // -------------------------------------------------------------------------
    // Create payment in status "prepared"
    const alicePayRes = await fetch(`${server.url}/v1/payments`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        intentId: approvedIntent.id,
        amount: "50.00",
        asset: "USDC",
        recipient: aliceRcp,
        status: "prepared"
      })
    });
    assert.equal(alicePayRes.status, 201);
    const alicePayment = (await alicePayRes.json()).payment;
    assert.equal(alicePayment.status, "prepared");

    // POST /v1/payments/:id/execute -> 403 server_signing_disallowed
    const execRes = await fetch(`${server.url}/v1/payments/${alicePayment.id}/execute`, {
      method: "POST",
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(execRes.status, 403);
    const execJson = await execRes.json();
    assert.equal(execJson.error, "server_signing_disallowed");

    // POST /v1/payments/:id/execute-async -> 403 server_signing_disallowed
    const execAsyncRes = await fetch(`${server.url}/v1/payments/${alicePayment.id}/execute-async`, {
      method: "POST",
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(execAsyncRes.status, 403);
    const execAsyncJson = await execAsyncRes.json();
    assert.equal(execAsyncJson.error, "server_signing_disallowed");

    // Legacy unversioned /payments/:id/execute without auth is rejected (401 unauthorized)
    const legacyNoAuth = await fetch(`${server.url}/payments/${alicePayment.id}/execute`, {
      method: "POST"
    });
    assert.equal(legacyNoAuth.status, 401);

    // Legacy unversioned /payments/:id/execute with auth is rejected (403 server_signing_disallowed)
    const legacyExecRes = await fetch(`${server.url}/payments/${alicePayment.id}/execute`, {
      method: "POST",
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(legacyExecRes.status, 403);
    assert.equal((await legacyExecRes.json()).error, "server_signing_disallowed");

    // Legacy unversioned /payments/:id/execute-async with auth is rejected (403 server_signing_disallowed)
    const legacyExecAsyncRes = await fetch(`${server.url}/payments/${alicePayment.id}/execute-async`, {
      method: "POST",
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(legacyExecAsyncRes.status, 403);
    assert.equal((await legacyExecAsyncRes.json()).error, "server_signing_disallowed");

    // -------------------------------------------------------------------------
    // 6. Payment State Transitions: prepared -> submitted -> confirmed
    //    Accepting submission is NOT proof of settlement.
    // -------------------------------------------------------------------------
    const validTxHash1 = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const submitRes = await fetch(`${server.url}/v1/payments/${alicePayment.id}/submission`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        txHash: validTxHash1,
        chainId: 5042
      })
    });
    assert.equal(submitRes.status, 200);
    const submitBody = await submitRes.json();
    assert.equal(submitBody.ok, true);
    assert.equal(submitBody.submission.status, "submitted");

    // Verify payment status is strictly "submitted", NOT confirmed or settled
    const paymentAfterSubmit = await fetch(`${server.url}/v1/payments/${alicePayment.id}`, {
      headers: { authorization: `Bearer ${aliceToken}` }
    }).then((r) => r.json());
    assert.equal(paymentAfterSubmit.status, "submitted");
    assert.equal(paymentAfterSubmit.txHash, validTxHash1);

    // Idempotent re-submission of the SAME txHash succeeds
    const replaySubmit = await fetch(`${server.url}/v1/payments/${alicePayment.id}/submission`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        txHash: validTxHash1,
        chainId: 5042
      })
    });
    assert.equal(replaySubmit.status, 200);

    // Attempting to re-submit with a DIFFERENT txHash conflicts (409 duplicate_submission)
    const conflictingSubmit = await fetch(`${server.url}/v1/payments/${alicePayment.id}/submission`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        chainId: 5042
      })
    });
    assert.equal(conflictingSubmit.status, 409);
    assert.equal((await conflictingSubmit.json()).error, "duplicate_submission");

    // -------------------------------------------------------------------------
    // 7. Duplicate txHash across different payments is strictly rejected (409)
    // -------------------------------------------------------------------------
    // Create second payment for Alice
    const alicePay2Res = await fetch(`${server.url}/v1/payments`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        intentId: approvedIntent.id,
        amount: "25.00",
        asset: "USDC",
        recipient: aliceRcp,
        status: "prepared"
      })
    });
    assert.equal(alicePay2Res.status, 201);
    const alicePayment2 = (await alicePay2Res.json()).payment;

    // Attempting to submit Payment 2 using the txHash already used by Payment 1
    const duplicateTxRes = await fetch(`${server.url}/v1/payments/${alicePayment2.id}/submission`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        txHash: validTxHash1, // already used by Payment 1
        chainId: 5042
      })
    });
    assert.equal(duplicateTxRes.status, 409);
    assert.equal((await duplicateTxRes.json()).error, "duplicate_submission");

    // -------------------------------------------------------------------------
    // 8. Confirmation transition: submitted -> confirmed
    //    Cannot re-submit once confirmed
    // -------------------------------------------------------------------------
    const confirmRes = await fetch(`${server.url}/v1/payments/${alicePayment.id}/confirm`, {
      method: "POST",
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(confirmRes.status, 200);
    const confirmedPayment = (await confirmRes.json()).payment;
    assert.equal(confirmedPayment.status, "confirmed");

    // Attempting to re-submit payment after confirmation fails with 409 invalid_state_transition
    const submitAfterConfirm = await fetch(`${server.url}/v1/payments/${alicePayment.id}/submission`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        txHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        chainId: 5042
      })
    });
    assert.equal(submitAfterConfirm.status, 409);
    assert.equal((await submitAfterConfirm.json()).error, "invalid_state_transition");

    // -------------------------------------------------------------------------
    // 9. Activity Feed Scoping: Audited events recorded for payment submission & confirmation
    // -------------------------------------------------------------------------
    const activityRes = await fetch(`${server.url}/v1/activity`, {
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(activityRes.status, 200);
    const activity = await activityRes.json();
    assert.ok(Array.isArray(activity.items));
    assert.ok(activity.items.length >= 2);
  } finally {
    await server.stop();
    if (origKey !== undefined) {
      process.env.ARC_SETTLEMENT_PRIVATE_KEY = origKey;
    }
  }
});
