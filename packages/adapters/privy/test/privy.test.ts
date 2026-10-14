import test from "node:test";
import assert from "node:assert/strict";

import { createPrivyAdapter } from "../src/index.ts";

test("createPrivyAdapter builds a Privy server client config from runtime env", () => {
  const adapter = createPrivyAdapter({
    appId: "privy-app-id",
    appSecret: "privy-app-secret"
  });

  assert.equal(adapter.id, "privy");
  assert.equal(adapter.kind, "identity");
  assert.equal(adapter.config.appId, "privy-app-id");
  assert.equal(adapter.config.appSecret, "privy-app-secret");
  assert.equal(adapter.config.apiUrl, undefined);
  assert.equal(typeof adapter.createClient, "function");
});

test("createPrivyAdapter requires app credentials", () => {
  assert.throws(() => createPrivyAdapter({ appId: "", appSecret: "" }), {
    message: /Missing Privy app credentials/
  });
});

test("createPrivyTokenVerifier verifies valid JWT and extracts claims", async () => {
  const { generateKeyPair, SignJWT, exportSPKI } = await import("jose");
  const { createPrivyTokenVerifier } = await import("../src/index.ts");

  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const spki = await exportSPKI(publicKey);
  const appId = "cltestapp0000000000000000";

  const verifier = createPrivyTokenVerifier({
    appId,
    jwtVerificationKey: spki
  });

  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ sid: "sess_123" })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuer("privy.io")
    .setAudience(appId)
    .setSubject("did:privy:alice_test")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const claims = await verifier.verifyAccessToken(token);
  assert.equal(claims.app_id, appId);
  assert.equal(claims.issuer, "privy.io");
  assert.equal(claims.user_id, "did:privy:alice_test");
  assert.equal(claims.session_id, "sess_123");
});

test("createPrivyTokenVerifier rejects expired tokens", async () => {
  const { generateKeyPair, SignJWT, exportSPKI } = await import("jose");
  const { createPrivyTokenVerifier } = await import("../src/index.ts");

  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const spki = await exportSPKI(publicKey);
  const appId = "cltestapp0000000000000000";

  const verifier = createPrivyTokenVerifier({
    appId,
    jwtVerificationKey: spki
  });

  const now = Math.floor(Date.now() / 1000);
  const expiredToken = await new SignJWT({ sid: "sess_123" })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuer("privy.io")
    .setAudience(appId)
    .setSubject("did:privy:alice_test")
    .setIssuedAt(now - 7200)
    .setExpirationTime(now - 3600)
    .sign(privateKey);

  await assert.rejects(
    async () => verifier.verifyAccessToken(expiredToken),
    /Authentication token expired/
  );
});

test("createPrivyTokenVerifier rejects mismatched audience or invalid signature", async () => {
  const { generateKeyPair, SignJWT, exportSPKI } = await import("jose");
  const { createPrivyTokenVerifier } = await import("../src/index.ts");

  const { publicKey: pub1, privateKey: priv1 } = await generateKeyPair("ES256");
  const { privateKey: priv2 } = await generateKeyPair("ES256");
  const spki1 = await exportSPKI(pub1);
  const appId = "cltestapp0000000000000000";

  const verifier = createPrivyTokenVerifier({
    appId,
    jwtVerificationKey: spki1
  });

  const now = Math.floor(Date.now() / 1000);

  // Wrong audience
  const wrongAudToken = await new SignJWT({ sid: "sess_123" })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuer("privy.io")
    .setAudience("wrong_app_id")
    .setSubject("did:privy:alice_test")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(priv1);

  await assert.rejects(
    async () => verifier.verifyAccessToken(wrongAudToken),
    /Authentication token is invalid/
  );

  // Wrong signing key
  const wrongSigToken = await new SignJWT({ sid: "sess_123" })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuer("privy.io")
    .setAudience(appId)
    .setSubject("did:privy:alice_test")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(priv2);

  await assert.rejects(
    async () => verifier.verifyAccessToken(wrongSigToken),
    /Failed to verify authentication token/
  );
});

