import test from "node:test";
import assert from "node:assert/strict";
import { createSpaceService } from "../src/index.ts";

test("ensurePersonalSpace creates one Space on first call and returns identical Space idempotently", async () => {
  const service = createSpaceService();
  const userId = "usr_alice_123";

  const first = await service.ensurePersonalSpace(userId);
  assert.ok(first.id.startsWith("spc_"));
  assert.equal(first.type, "personal");
  assert.equal(first.ownerUserId, userId);
  assert.equal(first.status, "active");

  const second = await service.ensurePersonalSpace(userId);
  assert.equal(second.id, first.id);
  assert.equal(second.ownerUserId, userId);
});

test("concurrent calls to ensurePersonalSpace return the same personal space", async () => {
  const service = createSpaceService();
  const userId = "usr_bob_456";

  const [s1, s2, s3] = await Promise.all([
    service.ensurePersonalSpace(userId),
    service.ensurePersonalSpace(userId),
    service.ensurePersonalSpace(userId)
  ]);

  assert.equal(s1.id, s2.id);
  assert.equal(s2.id, s3.id);
});

test("requireActiveMembership succeeds for owner and member, but throws for non-member or revoked", async () => {
  const service = createSpaceService();
  const alice = "usr_alice_789";
  const bob = "usr_bob_999";

  const space = await service.ensurePersonalSpace(alice);

  // Alice is the owner, should succeed
  const aliceMembership = await service.requireActiveMembership(alice, space.id);
  assert.equal(aliceMembership.role, "owner");
  assert.equal(aliceMembership.status, "active");

  // Bob is not a member, should fail
  await assert.rejects(
    async () => {
      await service.requireActiveMembership(bob, space.id);
    },
    /Active membership in space .* required/
  );

  // If membership is revoked
  await service.revokeMembership(alice, space.id);
  await assert.rejects(
    async () => {
      await service.requireActiveMembership(alice, space.id);
    },
    /Active membership in space .* required/
  );
});

test("assertSpaceOwnership enforces owner-only access", async () => {
  const service = createSpaceService();
  const alice = "usr_alice";
  const bob = "usr_bob";

  const space = await service.ensurePersonalSpace(alice);

  await assert.doesNotReject(async () => {
    await service.assertSpaceOwnership(alice, space.id);
  });

  await assert.rejects(
    async () => {
      await service.assertSpaceOwnership(bob, space.id);
    },
    /Ownership of space .* required/
  );
});
