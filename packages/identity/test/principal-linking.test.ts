import test from "node:test";
import assert from "node:assert/strict";
import {
  createIdentityService,
  createWalletLinkChallenge,
  verifyWalletLinkChallenge,
  type ExternalIdentity
} from "../src/index.ts";
import { privateKeyToAccount } from "viem/accounts";

test("resolveOrCreatePrincipal creates new canonical principal for new external identity", async () => {
  const service = createIdentityService();
  const ext: ExternalIdentity = {
    provider: "privy",
    subject: "did:privy:alice_123",
    linkedAt: new Date().toISOString()
  };

  const res = await service.resolveOrCreatePrincipal({
    externalIdentity: ext,
    email: "alice@example.com"
  });

  assert.equal(res.created, true);
  assert.ok(res.user.id.startsWith("usr_"));
  assert.equal(res.user.email, "alice@example.com");
  assert.equal(res.user.privyUserId, "did:privy:alice_123");
});

test("repeated provider subject returns same principal", async () => {
  const service = createIdentityService();
  const ext: ExternalIdentity = {
    provider: "privy",
    subject: "did:privy:alice_123",
    linkedAt: new Date().toISOString()
  };

  const first = await service.resolveOrCreatePrincipal({
    externalIdentity: ext,
    email: "alice@example.com"
  });

  const second = await service.resolveOrCreatePrincipal({
    externalIdentity: ext,
    email: "alice@example.com"
  });

  assert.equal(second.created, false);
  assert.equal(second.user.id, first.user.id);
});

test("email update preserves principal ID", async () => {
  const service = createIdentityService();
  const ext: ExternalIdentity = {
    provider: "privy",
    subject: "did:privy:bob_456",
    linkedAt: new Date().toISOString()
  };

  const first = await service.resolveOrCreatePrincipal({
    externalIdentity: ext,
    email: "bob_old@example.com"
  });

  const second = await service.resolveOrCreatePrincipal({
    externalIdentity: ext,
    email: "bob_new@example.com"
  });

  assert.equal(second.user.id, first.user.id);
  assert.equal(second.user.email, "bob_new@example.com");
});

test("conflicting external identity mappings are rejected", async () => {
  const service = createIdentityService();
  const ext1: ExternalIdentity = {
    provider: "privy",
    subject: "did:privy:carol_789",
    linkedAt: new Date().toISOString()
  };

  await service.resolveOrCreatePrincipal({
    externalIdentity: ext1,
    email: "carol@example.com"
  });

  // If another subject tries to hijack carol's email, it should not hijack the principal
  const ext2: ExternalIdentity = {
    provider: "privy",
    subject: "did:privy:attacker_999",
    linkedAt: new Date().toISOString()
  };

  const third = await service.resolveOrCreatePrincipal({
    externalIdentity: ext2,
    email: "carol@example.com"
  });

  assert.notEqual(third.user.id, ext1.subject);
  // Attacker receives their own distinct principal, not carol's
  assert.notEqual(third.user.id, (await service.getUserByPrivyUserId(ext1.subject))?.id);
});

test("wallet linking challenge generation and cryptographic signature verification", async () => {
  // Test wallet
  const privateKey = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const account = privateKeyToAccount(privateKey);

  const challenge = createWalletLinkChallenge({
    userId: "usr_alice",
    spaceId: "spc_personal_alice",
    address: account.address,
    ttlMs: 60_000
  });

  assert.equal(challenge.userId, "usr_alice");
  assert.equal(challenge.spaceId, "spc_personal_alice");
  assert.equal(challenge.address.toLowerCase(), account.address.toLowerCase());
  assert.ok(challenge.message.includes(account.address.toLowerCase()));
  assert.ok(challenge.nonce.length >= 16);

  // Sign message
  const signature = await account.signMessage({ message: challenge.message });

  // Valid signature
  const isValid = await verifyWalletLinkChallenge({
    challenge,
    signature
  });
  assert.equal(isValid, true);

  // Expired challenge
  const expiredTime = new Date(Date.now() + 100_000);
  await assert.rejects(
    async () => {
      await verifyWalletLinkChallenge({
        challenge,
        signature,
        now: expiredTime
      });
    },
    /Challenge has expired/
  );

  // Wrong address signature
  const wrongAccount = privateKeyToAccount("0x1111111111111111111111111111111111111111111111111111111111111111");
  const wrongSignature = await wrongAccount.signMessage({ message: challenge.message });

  const isInvalid = await verifyWalletLinkChallenge({
    challenge,
    signature: wrongSignature
  });
  assert.equal(isInvalid, false);
});
