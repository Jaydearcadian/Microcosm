import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT, exportSPKI } from "jose";
import { privateKeyToAccount } from "viem/accounts";
import { NextRequest } from "next/server.js";
import { createApiServer } from "../../api/src/server.ts";
import { createPrivyTokenVerifier } from "../../../packages/adapters/privy/src/index.ts";
import { GET, POST } from "../app/v1/[...slug]/route.ts";
import { GET as healthGet } from "../app/health/route.ts";
import { GET as readinessGet } from "../app/readiness/route.ts";

test("Production Routes & Gateway: P0 Security & Adversarial Isolation Suite", async () => {
  // 1. Setup real ES256 crypto keys and Privy verifier
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const { privateKey: attackerPrivateKey } = await generateKeyPair("ES256");
  const spki = await exportSPKI(publicKey);
  const appId = "cltestapp_prod_gate_00000000";

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
  const apiOrigin = server.url;
  const originalProxy = process.env.MICROCOSM_API_PROXY;
  const originalDb = process.env.DATABASE_URL;
  const originalPrivyId = process.env.PRIVY_APP_ID;
  const originalPrivySec = process.env.PRIVY_APP_SECRET;
  const originalNetwork = process.env.ARC_NETWORK;

  process.env.MICROCOSM_API_PROXY = apiOrigin;
  process.env.DATABASE_URL = "postgres://microcosm:microcosm@127.0.0.1:5432/microcosm_test";
  process.env.PRIVY_APP_ID = appId;
  process.env.PRIVY_APP_SECRET = "test_privy_secret_value_123456789";
  process.env.ARC_NETWORK = "mainnet";

  const makeToken = async (opts: {
    sub: string;
    key?: typeof privateKey;
    expOffset?: number;
  }) => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ sid: "sess_prod_1" })
      .setProtectedHeader({ alg: "ES256", typ: "JWT" })
      .setIssuer("privy.io")
      .setAudience(appId)
      .setSubject(opts.sub)
      .setIssuedAt(now)
      .setExpirationTime(now + (opts.expOffset ?? 3600))
      .sign(opts.key ?? privateKey);
  };

  const aliceToken = await makeToken({ sub: "did:privy:alice_prod_1" });
  const bobToken = await makeToken({ sub: "did:privy:bob_prod_2" });
  const forgedToken = await makeToken({ sub: "did:privy:attacker", key: attackerPrivateKey });

  try {
    // =========================================================================
    // Test 1: Unconfigured Proxy Fails Closed (No Mock In-Memory Maps)
    // =========================================================================
    delete process.env.MICROCOSM_API_PROXY;
    const unconfiguredReq = new NextRequest("http://localhost:3000/v1/me");
    const unconfiguredRes = await GET(unconfiguredReq, { params: Promise.resolve({ slug: ["me"] }) });
    assert.equal(unconfiguredRes.status, 503);
    const unconfiguredJson = await unconfiguredRes.json();
    assert.equal(unconfiguredJson.code, "api_gateway_unconfigured");

    // Restore proxy
    process.env.MICROCOSM_API_PROXY = server.url;

    // =========================================================================
    // Test 2: Missing and Fabricated Tokens receive 401 on Protected Routes
    // =========================================================================
    // 2.1 Missing Authorization Header
    const noAuthReq = new NextRequest("http://localhost:3000/v1/me");
    const noAuthRes = await GET(noAuthReq, { params: Promise.resolve({ slug: ["me"] }) });
    assert.equal(noAuthRes.status, 401);

    // 2.2 Arbitrary string token ("Bearer random")
    const badTokenReq = new NextRequest("http://localhost:3000/v1/me", {
      headers: { authorization: "Bearer arbitrary_junk_token_value_here" }
    });
    const badTokenRes = await GET(badTokenReq, { params: Promise.resolve({ slug: ["me"] }) });
    assert.equal(badTokenRes.status, 401);

    // 2.3 Forged signature
    const forgedReq = new NextRequest("http://localhost:3000/v1/me", {
      headers: { authorization: `Bearer ${forgedToken}` }
    });
    const forgedRes = await GET(forgedReq, { params: Promise.resolve({ slug: ["me"] }) });
    assert.equal(forgedRes.status, 401);

    // =========================================================================
    // Test 3: Valid Token Verification & Stable Canonical Principal Resolution
    // =========================================================================
    // 3.1 Alice resolves to a valid principal
    const aliceReq = new NextRequest("http://localhost:3000/v1/me", {
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    const aliceRes = await GET(aliceReq, { params: Promise.resolve({ slug: ["me"] }) });
    assert.equal(aliceRes.status, 200);
    const aliceData = await aliceRes.json();
    assert.ok(aliceData.principal?.id);
    assert.ok(aliceData.activeSpace?.id);

    // 3.2 Bob resolves to a distinct principal
    const bobReq = new NextRequest("http://localhost:3000/v1/me", {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    const bobRes = await GET(bobReq, { params: Promise.resolve({ slug: ["me"] }) });
    assert.equal(bobRes.status, 200);
    const bobData = await bobRes.json();
    assert.notEqual(aliceData.principal.id, bobData.principal.id);
    assert.notEqual(aliceData.activeSpace.id, bobData.activeSpace.id);

    // =========================================================================
    // Test 4: Tenant Isolation Across Spaces and Resources
    // =========================================================================
    // 4.0 Alice creates a recipient
    const rcpReq = new NextRequest("http://localhost:3000/v1/recipients", {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        displayLabel: "Contractor Bob",
        address: "0x5b38da6a701c568545dcfcb03fcb875f56beddc4",
        recipientType: "wallet"
      })
    });
    const rcpRes = await POST(rcpReq, { params: Promise.resolve({ slug: ["recipients"] }) });
    assert.equal(rcpRes.status, 201);
    const rcpData = await rcpRes.json();
    const aliceRcpId = rcpData.id || rcpData.recipient?.id;

    // 4.1 Alice creates an envelope
    const createEnvReq = new NextRequest("http://localhost:3000/v1/envelopes", {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name: "Alice Payroll",
        asset: "USDC",
        maxAmountPerTx: "100.00",
        maxAmountPerDay: "1000.00",
        allowedRecipientIds: [aliceRcpId],
        schedule: { days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], startHourUtc: 0, endHourUtc: 24 }
      })
    });
    const createEnvRes = await POST(createEnvReq, { params: Promise.resolve({ slug: ["envelopes"] }) });
    assert.equal(createEnvRes.status, 201);
    const envData = await createEnvRes.json();
    const aliceEnvId = envData.id || envData.envelope?.id;
    assert.ok(aliceEnvId, "Envelope ID must be present");

    // 4.2 Bob attempts to access Alice's envelope -> receives non-leaking 404
    const bobEnvReq = new NextRequest(`http://localhost:3000/v1/envelopes/${aliceEnvId}`, {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    const bobEnvRes = await GET(bobEnvReq, { params: Promise.resolve({ slug: ["envelopes", aliceEnvId] }) });
    assert.equal(bobEnvRes.status, 404);

    // =========================================================================
    // Test 5: Cryptographic EIP-191 Wallet Linking & Single-Use Challenge Contract
    // =========================================================================
    const walletAccount = privateKeyToAccount(
      "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f36fe21"
    );

    // 5.1 Request wallet challenge returns client contract shape
    const chalReq = new NextRequest("http://localhost:3000/v1/wallet/challenge", {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ address: walletAccount.address })
    });
    const chalRes = await POST(chalReq, { params: Promise.resolve({ slug: ["wallet", "challenge"] }) });
    assert.equal(chalRes.status, 201);
    const chalData = await chalRes.json();
    assert.ok(chalData.challenge?.id);
    assert.ok(chalData.challenge?.message);
    assert.equal(chalData.challenge.address.toLowerCase(), walletAccount.address.toLowerCase());

    // 5.2 Invalid signature is rejected
    const badSigReq = new NextRequest("http://localhost:3000/v1/wallet/link", {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        challengeId: chalData.challenge.id,
        signature: "0x1234567890abcdef"
      })
    });
    const badSigRes = await POST(badSigReq, { params: Promise.resolve({ slug: ["wallet", "link"] }) });
    assert.equal(badSigRes.status, 400);

    // 5.3 Valid EIP-191 signature successfully links wallet
    const validSignature = await walletAccount.signMessage({ message: chalData.challenge.message });
    const linkReq = new NextRequest("http://localhost:3000/v1/wallet/link", {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        challengeId: chalData.challenge.id,
        signature: validSignature
      })
    });
    const linkRes = await POST(linkReq, { params: Promise.resolve({ slug: ["wallet", "link"] }) });
    assert.equal(linkRes.status, 200);
    const linkData = await linkRes.json();
    assert.equal(linkData.ok, true);
    assert.equal(linkData.wallet.address.toLowerCase(), walletAccount.address.toLowerCase());

    // 5.4 Replay attack: reusing the same challenge is rejected
    const replayReq = new NextRequest("http://localhost:3000/v1/wallet/link", {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        challengeId: chalData.challenge.id,
        signature: validSignature
      })
    });
    const replayRes = await POST(replayReq, { params: Promise.resolve({ slug: ["wallet", "link"] }) });
    assert.ok(
      [400, 409].includes(replayRes.status),
      `Expected 400 or 409 for replayed challenge, got ${replayRes.status}`
    );

    // =========================================================================
    // Test 6: Payment Preparation & Intent Binding
    // =========================================================================
    // 6.1 Payment preparation without approved intent is rejected
    const badPrepReq = new NextRequest("http://localhost:3000/v1/payments/prepare", {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ intentId: "non_existent_intent" })
    });
    const badPrepRes = await POST(badPrepReq, { params: Promise.resolve({ slug: ["payments", "prepare"] }) });
    assert.equal(badPrepRes.status, 404);

    // 6.2 Bob cannot submit or attach to Alice's payment
    const crossSubmitReq = new NextRequest("http://localhost:3000/v1/payments/pay_alice_fake/submission", {
      method: "POST",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111"
      })
    });
    const crossSubmitRes = await POST(crossSubmitReq, { params: Promise.resolve({ slug: ["payments", "pay_alice_fake", "submission"] }) });
    assert.equal(crossSubmitRes.status, 404);

    // =========================================================================
    // Test 7: Balance Read: Invalid Address 400 & Fail-Closed Behavior
    // =========================================================================
    // 7.1 Invalid EVM address returns 400 Bad Request
    const invalidBalReq = new NextRequest("http://localhost:3000/v1/balance?address=not_a_valid_evm_address");
    const invalidBalRes = await GET(invalidBalReq, { params: Promise.resolve({ slug: ["balance"] }) });
    assert.equal(invalidBalRes.status, 400);
    const invalidBalJson = await invalidBalRes.json();
    assert.equal(invalidBalJson.error, "invalid_address");

    // 7.2 Missing address without proxy returns 400
    delete process.env.MICROCOSM_API_PROXY;
    const missingBalReq = new NextRequest("http://localhost:3000/v1/balance");
    const missingBalRes = await GET(missingBalReq, { params: Promise.resolve({ slug: ["balance"] }) });
    assert.equal(missingBalRes.status, 400);
    process.env.MICROCOSM_API_PROXY = server.url;

    // 7.3 Valid address reads live Arc USDC balance (zero balance when unfunded, but valid structure)
    const validBalReq = new NextRequest("http://localhost:3000/v1/balance?address=0x5b38da6a701c568545dcfcb03fcb875f56beddc4");
    const validBalRes = await GET(validBalReq, { params: Promise.resolve({ slug: ["balance"] }) });
    assert.equal(validBalRes.status, 200);
    const validBalJson = await validBalRes.json();
    assert.equal(validBalJson.asset, "USDC");
    assert.equal(validBalJson.decimals, 6);
    assert.equal(validBalJson.chainId, 5042);
    assert.equal(validBalJson.tokenAddress, "0x3600000000000000000000000000000000000000");

    // =========================================================================
    // Test 9: Authorized Payment Pipeline (Intent -> Prepare -> Submission)
    // =========================================================================
    // 9.1 Alice creates an intent within envelope limits
    const intentReq = new NextRequest("http://localhost:3000/v1/intents", {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: "send_money",
        envelopeId: aliceEnvId,
        recipientId: aliceRcpId,
        recipientAddress: "0x5b38da6a701c568545dcfcb03fcb875f56beddc4",
        amount: "5.00",
        amountBaseUnits: "5000000",
        asset: "USDC",
        executedAt: new Date().toISOString(),
        spentToday: "0"
      })
    });
    const intentRes = await POST(intentReq, { params: Promise.resolve({ slug: ["intents"] }) });
    if (intentRes.status !== 201) {
      console.error("INTENT ERROR:", await intentRes.text());
    }
    assert.equal(intentRes.status, 201);
    const intentData = await intentRes.json();
    const aliceIntentId = intentData.intent.id;
    assert.equal(intentData.intent.status, "approved");

    // 9.2 Alice prepares payment for the approved intent
    const prepReq = new NextRequest("http://localhost:3000/v1/payments/prepare", {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ intentId: aliceIntentId })
    });
    const prepRes = await POST(prepReq, { params: Promise.resolve({ slug: ["payments", "prepare"] }) });
    assert.equal(prepRes.status, 200);
    const prepData = await prepRes.json();
    assert.ok(prepData.intentId);
    assert.ok(prepData.calldata.startsWith("0xa9059cbb")); // ERC-20 transfer(address,uint256) selector
    assert.equal(prepData.chainId, 5042);
    assert.equal(prepData.tokenAddress, "0x3600000000000000000000000000000000000000");

    // 9.3 Alice records submission
    const submitReq = new NextRequest("http://localhost:3000/v1/payments/submission", {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        intentId: prepData.intentId,
        txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      })
    });
    const submitRes = await POST(submitReq, { params: Promise.resolve({ slug: ["payments", "submission"] }) });
    assert.equal(submitRes.status, 200);
    const submitData = await submitRes.json();
    assert.equal(submitData.submission.status, "submitted");
    const alicePaymentId = submitData.submission.paymentId;

    // =========================================================================
    // Test 10: Confirmation Fail-Closed & Adversarial Cross-Tenant Protection
    // =========================================================================
    // 10.1 Bob cannot confirm Alice's payment (receives 404)
    const bobConfirmReq = new NextRequest(`http://localhost:3000/v1/payments/${alicePaymentId}/confirm`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${bobToken}`,
        "content-type": "application/json"
      }
    });
    const bobConfirmRes = await POST(bobConfirmReq, { params: Promise.resolve({ slug: ["payments", alicePaymentId, "confirm"] }) });
    assert.equal(bobConfirmRes.status, 404);

    // 10.2 Unauthenticated caller receives 401
    const anonConfirmReq = new NextRequest(`http://localhost:3000/v1/payments/${alicePaymentId}/confirm`, {
      method: "POST"
    });
    const anonConfirmRes = await POST(anonConfirmReq, { params: Promise.resolve({ slug: ["payments", alicePaymentId, "confirm"] }) });
    assert.equal(anonConfirmRes.status, 401);

    // =========================================================================
    // Test 11: Activity Feed Scoped by Space
    // =========================================================================
    const activityReq = new NextRequest("http://localhost:3000/v1/activity", {
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    const activityRes = await GET(activityReq, { params: Promise.resolve({ slug: ["activity"] }) });
    assert.equal(activityRes.status, 200);
    // =========================================================================
    // Test 12: Health & Readiness Endpoints
    // =========================================================================
    const healthRes = await healthGet();
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.equal(healthData.service, "microcosm-web-gateway");
    assert.equal(healthData.chainId, 5042);
    assert.equal(healthData.apiProxyConfigured, true);

    const readinessRes = await readinessGet();
    assert.equal(readinessRes.status, 200);
    const readinessData = await readinessRes.json();
    assert.equal(readinessData.status, "ready");
    assert.equal(readinessData.arcRpc.status, "ok");
    assert.equal(readinessData.arcRpc.expectedChainId, 5042);
    assert.equal(readinessData.apiUpstream.status, "ok");
    assert.equal(readinessData.apiUpstream.expectedChainId, 5042);
    assert.equal(readinessData.apiUpstream.observedChainId, 5042);
    assert.ok(Array.isArray(readinessData.apiUpstream.checks));
    assert.ok(readinessData.apiUpstream.checks.some((c: any) => c.name === "postgres" && c.status === "ok"));
    assert.ok(readinessData.apiUpstream.checks.some((c: any) => c.name === "arc_rpc" && c.status === "ok"));
    assert.ok(readinessData.apiUpstream.checks.some((c: any) => c.name === "privy" && c.status === "ok"));

    // 12.3 When upstream is unreachable or returns 503, gateway readiness fails closed with 503
    process.env.MICROCOSM_API_PROXY = "http://127.0.0.1:19999"; // Non-existent port
    const unreachableRes = await readinessGet();
    assert.equal(unreachableRes.status, 503);
    const unreachableData = await unreachableRes.json();
    assert.equal(unreachableData.status, "degraded");
    assert.equal(unreachableData.apiUpstream.status, "unreachable");

    // Restore valid proxy
    process.env.MICROCOSM_API_PROXY = apiOrigin;


  } finally {
    if (originalProxy !== undefined) {
      process.env.MICROCOSM_API_PROXY = originalProxy;
    } else {
      delete process.env.MICROCOSM_API_PROXY;
    }
    if (originalDb !== undefined) {
      process.env.DATABASE_URL = originalDb;
    } else {
      delete process.env.DATABASE_URL;
    }
    if (originalPrivyId !== undefined) {
      process.env.PRIVY_APP_ID = originalPrivyId;
    } else {
      delete process.env.PRIVY_APP_ID;
    }
    if (originalPrivySec !== undefined) {
      process.env.PRIVY_APP_SECRET = originalPrivySec;
    } else {
      delete process.env.PRIVY_APP_SECRET;
    }
    if (originalNetwork !== undefined) {
      process.env.ARC_NETWORK = originalNetwork;
    } else {
      delete process.env.ARC_NETWORK;
    }
    await server.stop();
  }
});
