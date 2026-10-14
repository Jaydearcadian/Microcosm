import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT, exportSPKI } from "jose";

import {
  AuthError,
  extractBearerToken,
  getHeader,
  verifyRequestPrincipal,
  authenticateAndAuthorize,
  type RequestLike
} from "./auth.ts";
import { createIdentityService } from "../../../packages/identity/src/index.ts";
import { createSpaceService } from "../../../packages/spaces/src/index.ts";
import { createPrivyTokenVerifier } from "../../../packages/adapters/privy/src/index.ts";

test("auth module: extractBearerToken extracts token and rejects invalid headers", () => {
  assert.equal(extractBearerToken("Bearer token123"), "token123");
  assert.equal(extractBearerToken("bearer token456"), "token456");

  assert.throws(() => extractBearerToken(undefined), {
    name: "AuthError",
    message: /Missing Authorization header/
  });
  assert.throws(() => extractBearerToken(""), {
    name: "AuthError",
    message: /Missing Authorization header/
  });
  assert.throws(() => extractBearerToken("Basic user:pass"), {
    name: "AuthError",
    message: /Malformed authorization header/
  });
  assert.throws(() => extractBearerToken("Bearer"), {
    name: "AuthError",
    message: /Malformed authorization header/
  });
});

test("auth module: getHeader retrieves case-insensitive headers", () => {
  const req: RequestLike = {
    headers: {
      Authorization: "Bearer abc",
      "X-Space-ID": "spc_1"
    }
  };

  assert.equal(getHeader(req, "authorization"), "Bearer abc");
  assert.equal(getHeader(req, "Authorization"), "Bearer abc");
  assert.equal(getHeader(req, "x-space-id"), "spc_1");
  assert.equal(getHeader(req, "non-existent"), undefined);
});

test("auth module: verifyRequestPrincipal verifies token and maps to internal principal", async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const spki = await exportSPKI(publicKey);
  const appId = "cltestapp0000000000000000";

  const verifier = createPrivyTokenVerifier({
    appId,
    jwtVerificationKey: spki
  });
  const identityService = createIdentityService();

  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ sid: "sess_1" })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuer("privy.io")
    .setAudience(appId)
    .setSubject("did:privy:alice_42")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const req: RequestLike = {
    headers: { authorization: `Bearer ${token}` }
  };

  const verified = await verifyRequestPrincipal(req, verifier, identityService);
  assert.equal(verified.providerSubject, "did:privy:alice_42");
  assert.ok(verified.userId.startsWith("usr_"));
});

test("auth module: authenticateAndAuthorize handles full session, principal resolution, and space context", async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const spki = await exportSPKI(publicKey);
  const appId = "cltestapp0000000000000000";

  const verifier = createPrivyTokenVerifier({
    appId,
    jwtVerificationKey: spki
  });
  const identityService = createIdentityService();
  const spaceService = createSpaceService();

  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ sid: "sess_abc" })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuer("privy.io")
    .setAudience(appId)
    .setSubject("did:privy:alice_test")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const req: RequestLike = {
    headers: { authorization: `Bearer ${token}` }
  };

  // 1. Initial authentication and space resolution
  const context1 = await authenticateAndAuthorize(req, {
    verifier,
    identityService,
    spaceService
  });

  assert.equal(context1.providerSubject, "did:privy:alice_test");
  assert.equal(context1.sessionId, "sess_abc");
  assert.ok(context1.principal.id.startsWith("usr_"));
  assert.ok(context1.personalSpace.id.startsWith("spc_"));
  assert.equal(context1.space.id, context1.personalSpace.id);
  assert.equal(context1.membership.role, "owner");
  assert.equal(context1.membership.status, "active");

  // 2. Repeated authentication with same token returns identical principal and personal space
  const context2 = await authenticateAndAuthorize(req, {
    verifier,
    identityService,
    spaceService
  });

  assert.equal(context2.principal.id, context1.principal.id);
  assert.equal(context2.personalSpace.id, context1.personalSpace.id);
  assert.equal(context2.space.id, context1.space.id);
});

test("auth module: rejects expired token with token_expired", async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const spki = await exportSPKI(publicKey);
  const appId = "cltestapp0000000000000000";

  const verifier = createPrivyTokenVerifier({
    appId,
    jwtVerificationKey: spki
  });
  const identityService = createIdentityService();
  const spaceService = createSpaceService();

  const now = Math.floor(Date.now() / 1000);
  const expiredToken = await new SignJWT({ sid: "sess_exp" })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuer("privy.io")
    .setAudience(appId)
    .setSubject("did:privy:expired_user")
    .setIssuedAt(now - 7200)
    .setExpirationTime(now - 3600)
    .sign(privateKey);

  const req: RequestLike = {
    headers: { authorization: `Bearer ${expiredToken}` }
  };

  await assert.rejects(
    async () => authenticateAndAuthorize(req, { verifier, identityService, spaceService }),
    (err: unknown) => {
      assert.ok(err instanceof AuthError);
      assert.equal(err.status, 401);
      assert.equal(err.code, "token_expired");
      return true;
    }
  );
});

test("auth module: rejects client-supplied conflicting principal ID", async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const spki = await exportSPKI(publicKey);
  const appId = "cltestapp0000000000000000";

  const verifier = createPrivyTokenVerifier({
    appId,
    jwtVerificationKey: spki
  });
  const identityService = createIdentityService();
  const spaceService = createSpaceService();

  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ sid: "sess_spoof" })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuer("privy.io")
    .setAudience(appId)
    .setSubject("did:privy:alice_test")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const req: RequestLike = {
    headers: {
      authorization: `Bearer ${token}`,
      "x-principal-id": "usr_victim_id"
    }
  };

  await assert.rejects(
    async () => authenticateAndAuthorize(req, { verifier, identityService, spaceService }),
    (err: unknown) => {
      assert.ok(err instanceof AuthError);
      assert.equal(err.status, 403);
      assert.equal(err.code, "identity_mismatch");
      return true;
    }
  );
});

test("auth module: cross-space unauthorized access returns 404 space_not_found without leaking existence", async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const spki = await exportSPKI(publicKey);
  const appId = "cltestapp0000000000000000";

  const verifier = createPrivyTokenVerifier({
    appId,
    jwtVerificationKey: spki
  });
  const identityService = createIdentityService();
  const spaceService = createSpaceService();

  // Create Bob's personal space
  const bobSpace = await spaceService.ensurePersonalSpace("usr_bob");

  // Alice authenticates
  const now = Math.floor(Date.now() / 1000);
  const aliceToken = await new SignJWT({ sid: "sess_alice" })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuer("privy.io")
    .setAudience(appId)
    .setSubject("did:privy:alice_attacker")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  // Alice tries to access Bob's space via x-space-id header
  const req: RequestLike = {
    headers: {
      authorization: `Bearer ${aliceToken}`,
      "x-space-id": bobSpace.id
    }
  };

  await assert.rejects(
    async () => authenticateAndAuthorize(req, { verifier, identityService, spaceService }),
    (err: unknown) => {
      assert.ok(err instanceof AuthError);
      // Returns 404 space_not_found so Alice cannot determine that Bob's space exists
      assert.equal(err.status, 404);
      assert.equal(err.code, "space_not_found");
      return true;
    }
  );
});

test("auth module: space role requirements enforce owner authorization", async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const spki = await exportSPKI(publicKey);
  const appId = "cltestapp0000000000000000";

  const verifier = createPrivyTokenVerifier({
    appId,
    jwtVerificationKey: spki
  });
  const identityService = createIdentityService();
  const spaceService = createSpaceService();

  // Resolve Alice principal
  const alice = await identityService.resolveOrCreatePrincipal({
    externalIdentity: {
      provider: "privy",
      subject: "did:privy:alice",
      linkedAt: new Date().toISOString()
    }
  });

  // Resolve Bob principal and personal space
  const bob = await identityService.resolveOrCreatePrincipal({
    externalIdentity: {
      provider: "privy",
      subject: "did:privy:bob",
      linkedAt: new Date().toISOString()
    }
  });
  const sharedSpace = await spaceService.ensurePersonalSpace(bob.user.id);

  const now = Math.floor(Date.now() / 1000);
  const aliceToken = await new SignJWT({ sid: "sess_alice" })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuer("privy.io")
    .setAudience(appId)
    .setSubject("did:privy:alice")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const req: RequestLike = {
    headers: {
      authorization: `Bearer ${aliceToken}`,
      "x-space-id": sharedSpace.id
    }
  };

  // When owner role is required, non-owner is rejected
  await assert.rejects(
    async () =>
      authenticateAndAuthorize(req, {
        verifier,
        identityService,
        spaceService,
        requiredRole: "owner"
      }),
    (err: unknown) => {
      assert.ok(err instanceof AuthError);
      assert.equal(err.status, 404); // Not a member of sharedSpace
      return true;
    }
  );
});
