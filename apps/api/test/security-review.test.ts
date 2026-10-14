import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT, exportSPKI } from "jose";
import { privateKeyToAccount } from "viem/accounts";
import { createApiServer } from "../src/server.ts";
import { createPrivyTokenVerifier } from "../../../packages/adapters/privy/src/index.ts";
import {
  createNodePostgresClient,
  createPostgresAppRepository,
  createPostgresSpaceService,
  applyPostgresSchema
} from "../../../packages/db/src/index.ts";

test("Task 9: Security Review & Identity Gate (Gates G0 & G1 Verification)", async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const spki = await exportSPKI(publicKey);
  const appId = "cltestapp_task9_security_0000";

  const verifier = createPrivyTokenVerifier({
    appId,
    jwtVerificationKey: spki
  });

  // Track confirmation state for mock receipt verification
  let receiptConfirmed = false;
  const mockConfirmer = async (txHash: string) => ({
    confirmed: receiptConfirmed,
    checkedAt: new Date().toISOString()
  });

  const server = createApiServer({
    auth: {
      verifier,
      required: true
    },
    settlement: {
      confirmer: mockConfirmer
    }
  });

  await server.start();

  const makeToken = async (sub: string, email?: string) => {
    const now = Math.floor(Date.now() / 1000);
    const payload: Record<string, unknown> = { sid: `sess_${sub}` };
    if (email) payload.email = email;
    return new SignJWT(payload)
      .setProtectedHeader({ alg: "ES256", typ: "JWT" })
      .setIssuer("privy.io")
      .setAudience(appId)
      .setSubject(sub)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);
  };

  const aliceToken = await makeToken("did:privy:alice_sec_9", "alice@example.com");
  const bobToken = await makeToken("did:privy:bob_sec_9", "bob@example.com");
  const charlieToken = await makeToken("did:privy:charlie_sec_9", "charlie@example.com");

  try {
    // =========================================================================
    // 1. Principal & Space Resolution
    // =========================================================================
    const aliceMeRes = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(aliceMeRes.status, 200);
    const aliceMe = await aliceMeRes.json();
    const alicePrincipalId = aliceMe.user.id;
    const aliceSpaceId = aliceMe.activeSpace.id;
    assert.ok(alicePrincipalId.startsWith("usr_"));
    assert.ok(aliceSpaceId.startsWith("spc_"));

    const bobMeRes = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    assert.equal(bobMeRes.status, 200);
    const bobMe = await bobMeRes.json();
    const bobPrincipalId = bobMe.user.id;
    const bobSpaceId = bobMe.activeSpace.id;
    assert.notEqual(alicePrincipalId, bobPrincipalId);
    assert.notEqual(aliceSpaceId, bobSpaceId);

    // =========================================================================
    // 2. Adversarial Tenant Isolation (HTTP Non-Leaking 404s & Cross-Space Blocks)
    // =========================================================================
    // Alice creates recipient, envelope, intent, payment
    const aliceEnvRes = await fetch(`${server.url}/v1/envelopes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: "env_alice_sec9",
        asset: "USDC",
        maxAmountPerTx: "50.00",
        maxAmountPerDay: "500.00",
        allowedRecipientIds: ["rcp_alice_vendor"],
        schedule: { days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], startHourUtc: 0, endHourUtc: 24 }
      })
    });
    assert.equal(aliceEnvRes.status, 201);
    const aliceEnv = await aliceEnvRes.json();

    const aliceRcpRes = await fetch(`${server.url}/v1/recipients`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: "rcp_alice_vendor",
        recipientType: "wallet",
        displayLabel: "Alice Vendor",
        address: "0x1111111111111111111111111111111111111111"
      })
    });
    assert.equal(aliceRcpRes.status, 201);
    const aliceRcp = (await aliceRcpRes.json()).recipient;

    const aliceIntentRes = await fetch(`${server.url}/v1/intents`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: "int_alice_sec9",
        type: "send_money",
        envelopeId: aliceEnv.id,
        recipientId: aliceRcp.id,
        amount: "15.00",
        asset: "USDC",
        executedAt: new Date().toISOString(),
        spentToday: "0.00"
      })
    });
    assert.equal(aliceIntentRes.status, 201);
    const aliceIntent = (await aliceIntentRes.json()).intent;
    assert.equal(aliceIntent.status, "approved");

    const alicePaymentRes = await fetch(`${server.url}/v1/payments`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: "pay_alice_sec9",
        intentId: aliceIntent.id,
        amount: "15.00",
        asset: "USDC",
        recipient: aliceRcp,
        status: "prepared"
      })
    });
    assert.equal(alicePaymentRes.status, 201);
    const alicePayment = (await alicePaymentRes.json()).payment;

    // --- Bob adversarial attacks against Alice's resources ---
    // (a) Bob cannot read Alice's space
    const bobGetSpace = await fetch(`${server.url}/v1/spaces/${aliceSpaceId}`, {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    assert.equal(bobGetSpace.status, 404);

    // (b) Bob cannot read Alice's recipient
    const bobGetRcp = await fetch(`${server.url}/v1/recipients/${aliceRcp.id}`, {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    assert.equal(bobGetRcp.status, 404);

    // (c) Bob cannot claim Alice's recipient
    const bobClaimRcp = await fetch(`${server.url}/v1/recipients/${aliceRcp.id}/claim`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ privyUserId: "did:privy:bob_sec_9" })
    });
    assert.equal(bobClaimRcp.status, 404);

    // (d) Bob cannot read Alice's envelope
    const bobGetEnv = await fetch(`${server.url}/v1/envelopes/${aliceEnv.id}`, {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    assert.equal(bobGetEnv.status, 404);

    // (e) Bob cannot read Alice's intent
    const bobGetIntent = await fetch(`${server.url}/v1/intents/${aliceIntent.id}`, {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    assert.equal(bobGetIntent.status, 404);

    // (f) Bob cannot read Alice's payment
    const bobGetPayment = await fetch(`${server.url}/v1/payments/${alicePayment.id}`, {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    assert.equal(bobGetPayment.status, 404);

    // (g) Bob cannot create an intent referencing Alice's envelope (nested cross-space reference)
    const bobCrossEnvIntent = await fetch(`${server.url}/v1/intents`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        envelopeId: aliceEnv.id, // Alice's envelope
        amount: "10.00",
        asset: "USDC"
      })
    });
    assert.equal(bobCrossEnvIntent.status, 404);
    assert.equal((await bobCrossEnvIntent.json()).error, "envelope_not_found");

    // (h) Bob cannot create an intent referencing Alice's recipient (nested cross-space reference)
    const bobCrossRcpIntent = await fetch(`${server.url}/v1/intents`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        recipientId: aliceRcp.id, // Alice's recipient
        amount: "10.00",
        asset: "USDC"
      })
    });
    assert.equal(bobCrossRcpIntent.status, 404);
    assert.equal((await bobCrossRcpIntent.json()).error, "recipient_not_found");

    // (i) Bob cannot prepare payment for Alice's intent
    const bobPrepPay = await fetch(`${server.url}/v1/payments/prepare`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ intentId: aliceIntent.id })
    });
    assert.equal(bobPrepPay.status, 404);

    // (j) Bob cannot submit transaction for Alice's payment
    const bobSubmitPay = await fetch(`${server.url}/v1/payments/${alicePayment.id}/submission`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        txHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
        chainId: 5042
      })
    });
    assert.equal(bobSubmitPay.status, 404);

    // (k) Bob cannot confirm Alice's payment
    const bobConfirmPay = await fetch(`${server.url}/v1/payments/${alicePayment.id}/confirm`, {
      method: "POST",
      headers: { authorization: `Bearer ${bobToken}` }
    });
    assert.equal(bobConfirmPay.status, 404);

    // (l) Bob's activity feed contains zero Alice audit events
    const bobActivityRes = await fetch(`${server.url}/v1/activity`, {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    assert.equal(bobActivityRes.status, 200);
    const bobActivity = await bobActivityRes.json();
    for (const item of bobActivity.items) {
      assert.notEqual(item.objectId, alicePayment.id);
      assert.notEqual(item.objectId, aliceIntent.id);
      assert.notEqual(item.objectId, aliceEnv.id);
    }

    // (m) Conflicting client-supplied ownership fields are strictly rejected (403 identity_mismatch)
    const bobSpoofOwner = await fetch(`${server.url}/v1/envelopes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        asset: "USDC",
        maxAmountPerTx: "10.00",
        maxAmountPerDay: "100.00",
        ownerUserId: alicePrincipalId // spoofing Alice's principal ID
      })
    });
    assert.equal(bobSpoofOwner.status, 403);
    assert.equal((await bobSpoofOwner.json()).error, "identity_mismatch");

    // =========================================================================
    // 3. PostgreSQL Repository-Level Scoping & Isolation
    // =========================================================================
    const connectionString =
      process.env.DATABASE_URL ||
      "postgres://microcosm:microcosm@127.0.0.1:5432/microcosm_test";
    const pgClient = await createNodePostgresClient({ connectionString });
    try {
      await applyPostgresSchema(pgClient);
      const pgRepo = createPostgresAppRepository({ client: pgClient });
      const pgSpaces = createPostgresSpaceService({ client: pgClient });

      await pgRepo.upsertUser({
        id: "usr_pg_alice",
        email: "pg_alice@example.com",
        privyUserId: "did:privy:pg_alice"
      });
      await pgRepo.upsertUser({
        id: "usr_pg_bob",
        email: "pg_bob@example.com",
        privyUserId: "did:privy:pg_bob"
      });

      const pgAliceSpace = await pgSpaces.ensurePersonalSpace("usr_pg_alice");
      const pgBobSpace = await pgSpaces.ensurePersonalSpace("usr_pg_bob");

      // Save Alice records in Postgres
      await pgRepo.upsertEnvelope({
        id: "env_pg_alice",
        spaceId: pgAliceSpace.id,
        asset: "USDC",
        maxAmountPerTx: "100.00",
        maxAmountPerDay: "1000.00",
        allowedRecipientIds: [],
        schedule: { days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], startHourUtc: 0, endHourUtc: 24 }
      });

      await pgRepo.upsertRecipient({
        id: "rcp_pg_alice",
        spaceId: pgAliceSpace.id,
        lookupKey: "rcp_pg_alice@example.com",
        ownerType: "external",
        claimStatus: "claimed"
      });

      await pgRepo.upsertIntent({
        id: "int_pg_alice",
        spaceId: pgAliceSpace.id,
        envelopeId: "env_pg_alice",
        recipientId: "rcp_pg_alice",
        amount: "50.00",
        asset: "USDC",
        status: "approved",
        type: "send_money",
        executedAt: new Date().toISOString(),
        spentToday: "0.00"
      });

      await pgRepo.upsertPaymentState({
        payment: {
          id: "pay_pg_alice",
          spaceId: pgAliceSpace.id,
          intentId: "int_pg_alice",
          recipientId: "rcp_pg_alice",
          amount: "50.00",
          asset: "USDC",
          status: "prepared"
        },
        settlement: {
          paymentId: "pay_pg_alice",
          mode: "direct",
          chain: "arc",
          amount: "50.00",
          asset: "USDC",
          destination: "0x1111111111111111111111111111111111111111"
        }
      });

      await pgRepo.upsertAuditEvent({
        id: "aud_pg_alice",
        actorType: "user",
        actorId: "usr_pg_alice",
        eventType: "intent.created",
        objectType: "intent",
        objectId: "int_pg_alice",
        spaceId: pgAliceSpace.id,
        payload: {}
      });

      // Verify PostgreSQL repository-level tenant scoping:
      // When queried with Bob's spaceId, Alice's records must NOT be returned!
      assert.equal(await pgRepo.getEnvelope?.("env_pg_alice", pgBobSpace.id), undefined);
      assert.deepEqual(await pgRepo.listEnvelopes?.(pgBobSpace.id), []);

      assert.equal(await pgRepo.getIntent?.("int_pg_alice", pgBobSpace.id), undefined);
      assert.deepEqual(await pgRepo.listIntents?.(pgBobSpace.id), []);

      assert.equal(await pgRepo.getPayment?.("pay_pg_alice", pgBobSpace.id), undefined);
      assert.deepEqual(await pgRepo.listPayments?.(pgBobSpace.id), []);

      assert.deepEqual(await pgRepo.listRecipients?.(pgBobSpace.id), []);
      assert.deepEqual(await pgRepo.listAuditEvents?.(pgBobSpace.id), []);

      // Verify when queried with Alice's spaceId, records ARE returned
      assert.ok(await pgRepo.getEnvelope?.("env_pg_alice", pgAliceSpace.id));
      assert.equal((await pgRepo.listEnvelopes?.(pgAliceSpace.id))?.length, 1);
      assert.ok(await pgRepo.getIntent?.("int_pg_alice", pgAliceSpace.id));
      assert.equal((await pgRepo.listIntents?.(pgAliceSpace.id))?.length, 1);
      assert.ok(await pgRepo.getPayment?.("pay_pg_alice", pgAliceSpace.id));
      assert.equal((await pgRepo.listPayments?.(pgAliceSpace.id))?.length, 1);

      // Verify space membership & ownership constraints throw for Bob
      await assert.rejects(
        async () => pgSpaces.requireActiveMembership("usr_pg_bob", pgAliceSpace.id),
        /Active membership in space .* required/
      );
      await assert.rejects(
        async () => pgSpaces.assertSpaceOwnership("usr_pg_bob", pgAliceSpace.id),
        /Ownership of space .* required/
      );
    } finally {
      await pgClient.close?.();
    }

    // =========================================================================
    // 4. Viewer Role Permissions & Revocation Boundary
    // =========================================================================
    // Charlie fetches /v1/me to establish his canonical user
    const charlieMeRes = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: `Bearer ${charlieToken}` }
    });
    assert.equal(charlieMeRes.status, 200);
    const charlieMe = await charlieMeRes.json();
    const charliePrincipalId = charlieMe.user.id;

    // Alice creates a shared space and adds Charlie as viewer
    const appInstance = await server.app;

    const sharedSpace = await appInstance.spaces.createSpace(alicePrincipalId, {
      name: "Shared Team Space",
      type: "shared"
    });

    await appInstance.spaces.addMember({
      spaceId: sharedSpace.id,
      userId: charliePrincipalId,
      role: "viewer"
    });

    // Charlie accesses shared space with x-space-id header
    const charlieHeaders = {
      authorization: `Bearer ${charlieToken}`,
      "x-space-id": sharedSpace.id,
      "content-type": "application/json"
    };

    // Charlie READ operations succeed
    const charlieListEnv = await fetch(`${server.url}/v1/envelopes`, { headers: charlieHeaders });
    assert.equal(charlieListEnv.status, 200);

    const charlieListRcp = await fetch(`${server.url}/v1/recipients`, { headers: charlieHeaders });
    assert.equal(charlieListRcp.status, 200);

    const charlieListIntents = await fetch(`${server.url}/v1/intents`, { headers: charlieHeaders });
    assert.equal(charlieListIntents.status, 200);

    const charlieListPayments = await fetch(`${server.url}/v1/payments`, { headers: charlieHeaders });
    assert.equal(charlieListPayments.status, 200);

    const charlieListActivity = await fetch(`${server.url}/v1/activity`, { headers: charlieHeaders });
    assert.equal(charlieListActivity.status, 200);

    // Charlie MUTATION operations FAIL with 403 (forbidden)
    // 1. Create envelope
    const charlieMutEnv = await fetch(`${server.url}/v1/envelopes`, {
      method: "POST",
      headers: charlieHeaders,
      body: JSON.stringify({ asset: "USDC", maxAmountPerTx: "10.00", maxAmountPerDay: "100.00" })
    });
    assert.equal(charlieMutEnv.status, 403);
    assert.equal((await charlieMutEnv.json()).error, "forbidden");

    // 2. Create recipient
    const charlieMutRcp = await fetch(`${server.url}/v1/recipients`, {
      method: "POST",
      headers: charlieHeaders,
      body: JSON.stringify({ recipientType: "wallet", displayLabel: "Test", address: "0x2222222222222222222222222222222222222222" })
    });
    assert.equal(charlieMutRcp.status, 403);

    // 3. Create intent
    const charlieMutIntent = await fetch(`${server.url}/v1/intents`, {
      method: "POST",
      headers: charlieHeaders,
      body: JSON.stringify({ amount: "5.00", asset: "USDC" })
    });
    assert.equal(charlieMutIntent.status, 403);

    // 4. Prepare payment
    const charlieMutPrep = await fetch(`${server.url}/v1/payments/prepare`, {
      method: "POST",
      headers: charlieHeaders,
      body: JSON.stringify({ intentId: "int_any" })
    });
    assert.equal(charlieMutPrep.status, 403);

    // 5. Submit payment
    const charlieMutSub = await fetch(`${server.url}/v1/payments/submission`, {
      method: "POST",
      headers: charlieHeaders,
      body: JSON.stringify({
        txHash: "0x9999999999999999999999999999999999999999999999999999999999999999",
        intentId: "int_any"
      })
    });
    assert.equal(charlieMutSub.status, 403);

    // 6. Request wallet challenge
    const charlieMutWallet = await fetch(`${server.url}/v1/wallet/challenge`, {
      method: "POST",
      headers: charlieHeaders,
      body: JSON.stringify({ address: "0x2222222222222222222222222222222222222222" })
    });
    assert.equal(charlieMutWallet.status, 403);

    // Revocation Test: Alice revokes Charlie's membership
    await appInstance.spaces.revokeMembership(charliePrincipalId, sharedSpace.id);

    // Any operation by Charlie in shared space now returns 403 forbidden immediately
    const charlieRevokedRes = await fetch(`${server.url}/v1/envelopes`, { headers: charlieHeaders });
    assert.equal(charlieRevokedRes.status, 403);
    assert.equal((await charlieRevokedRes.json()).error, "forbidden");

    // =========================================================================
    // 5. Identity Continuity & Account Recovery
    // =========================================================================
    // (a) Fresh session with same Privy subject resolves to the exact same canonical principal
    const freshAliceToken = await makeToken("did:privy:alice_sec_9", "alice@example.com");
    const freshAliceRes = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: `Bearer ${freshAliceToken}` }
    });
    assert.equal(freshAliceRes.status, 200);
    const freshAliceMe = await freshAliceRes.json();
    assert.equal(freshAliceMe.user.id, alicePrincipalId);
    assert.equal(freshAliceMe.activeSpace.id, aliceSpaceId);

    // (b) Email update / new login method on provider preserves canonical principal
    const updatedEmailToken = await makeToken("did:privy:alice_sec_9", "alice_new_email@example.com");
    const updatedEmailRes = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: `Bearer ${updatedEmailToken}` }
    });
    assert.equal(updatedEmailRes.status, 200);
    const updatedEmailMe = await updatedEmailRes.json();
    assert.equal(updatedEmailMe.user.id, alicePrincipalId); // principal ID is unchanged

    // (c) Attacker creates account with matching email but different subject -> gets distinct principal
    const attackerToken = await makeToken("did:privy:attacker_sec_9", "alice@example.com");
    const attackerRes = await fetch(`${server.url}/v1/me`, {
      headers: { authorization: `Bearer ${attackerToken}` }
    });
    assert.equal(attackerRes.status, 200);
    const attackerMe = await attackerRes.json();
    assert.notEqual(attackerMe.user.id, alicePrincipalId); // does NOT hijack Alice's user id
    assert.notEqual(attackerMe.activeSpace.id, aliceSpaceId); // does NOT hijack Alice's space

    // =========================================================================
    // 6. Cryptographic EIP-191 Wallet Linking
    // =========================================================================
    const testWalletPk = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const testAccount = privateKeyToAccount(testWalletPk);

    // Alice requests challenge
    const challengeRes = await fetch(`${server.url}/v1/wallet/challenge`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ address: testAccount.address })
    });
    assert.equal(challengeRes.status, 201);
    const { challenge } = await challengeRes.json();
    assert.equal(challenge.address.toLowerCase(), testAccount.address.toLowerCase());
    assert.equal(challenge.userId, alicePrincipalId);

    // (a) Spoofed signature is rejected
    const spoofedLink = await fetch(`${server.url}/v1/wallet/link`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        challengeId: challenge.id,
        signature: "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001b"
      })
    });
    assert.equal(spoofedLink.status, 400);
    assert.equal((await spoofedLink.json()).error, "invalid_signature");

    // (b) Bob tries to consume Alice's challenge -> 403 identity_mismatch
    const validSig = await testAccount.signMessage({ message: challenge.message });
    const bobConsumeAlice = await fetch(`${server.url}/v1/wallet/link`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        challengeId: challenge.id,
        signature: validSig
      })
    });
    assert.equal(bobConsumeAlice.status, 403);
    assert.equal((await bobConsumeAlice.json()).error, "identity_mismatch");

    // (c) Alice consumes challenge with valid cryptographic signature
    const validLink = await fetch(`${server.url}/v1/wallet/link`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        challengeId: challenge.id,
        signature: validSig
      })
    });
    assert.equal(validLink.status, 200);
    const linkResult = await validLink.json();
    assert.equal(linkResult.ok, true);
    assert.equal(linkResult.wallet.verification, "signature_verified");
    assert.equal(linkResult.wallet.address.toLowerCase(), testAccount.address.toLowerCase());

    // (d) Replay attack: attempting to consume already-consumed challenge fails
    const replayLink = await fetch(`${server.url}/v1/wallet/link`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        challengeId: challenge.id,
        signature: validSig
      })
    });
    assert.equal(replayLink.status, 409);
    assert.equal((await replayLink.json()).error, "challenge_already_consumed");

    // =========================================================================
    // 7. Task 8 Invariant: Receipt-Gated Payment Confirmation
    // =========================================================================
    // Alice submits txHash for her payment
    const validTxHash = "0x8888888888888888888888888888888888888888888888888888888888888888";
    const submitPaymentRes = await fetch(`${server.url}/v1/payments/${alicePayment.id}/submission`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        txHash: validTxHash,
        chainId: 5042
      })
    });
    assert.equal(submitPaymentRes.status, 200);

    // Payment is in "submitted" state - NEVER confirmed by submission alone
    const checkPayment = await fetch(`${server.url}/v1/payments/${alicePayment.id}`, {
      headers: { authorization: `Bearer ${aliceToken}` }
    }).then((r) => r.json());
    assert.equal(checkPayment.status, "submitted");
    assert.equal(checkPayment.txHash, validTxHash);

    // Client calls /confirm while onchain receipt is unconfirmed (receiptConfirmed = false)
    receiptConfirmed = false;
    const unconfirmedAttempt = await fetch(`${server.url}/v1/payments/${alicePayment.id}/confirm`, {
      method: "POST",
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(unconfirmedAttempt.status, 409);
    const unconfirmedErr = await unconfirmedAttempt.json();
    assert.equal(unconfirmedErr.error, "unconfirmed_transaction");

    // Payment status remains "submitted"
    const checkStillSubmitted = await fetch(`${server.url}/v1/payments/${alicePayment.id}`, {
      headers: { authorization: `Bearer ${aliceToken}` }
    }).then((r) => r.json());
    assert.equal(checkStillSubmitted.status, "submitted");

    // Once receipt is verified onchain (receiptConfirmed = true), confirmation succeeds
    receiptConfirmed = true;
    const confirmedAttempt = await fetch(`${server.url}/v1/payments/${alicePayment.id}/confirm`, {
      method: "POST",
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(confirmedAttempt.status, 200);
    const confirmedBody = await confirmedAttempt.json();
    assert.equal(confirmedBody.ok, true);
    assert.equal(confirmedBody.payment.status, "confirmed");

    // Attempting to re-submit after confirmation fails with 409
    const reSubmitAfterConfirm = await fetch(`${server.url}/v1/payments/${alicePayment.id}/submission`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        txHash: "0x7777777777777777777777777777777777777777777777777777777777777777",
        chainId: 5042
      })
    });
    assert.equal(reSubmitAfterConfirm.status, 409);
    assert.equal((await reSubmitAfterConfirm.json()).error, "invalid_state_transition");
  } finally {
    await server.stop();
  }
});
