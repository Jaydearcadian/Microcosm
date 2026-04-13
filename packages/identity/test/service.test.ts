import test from "node:test";
import assert from "node:assert/strict";

import { createIdentityService } from "../src/index.ts";

test("identity service persists unknown email recipients and claims them into users", async () => {
  const identity = createIdentityService();

  const pending = identity.resolveRecipient({ email: "new-user@gmail.com" });
  assert.equal(pending.claimStatus, "pending-claim");

  const claimed = await identity.claimRecipient(pending.id, {
    email: "new-user@gmail.com",
    walletAddress: "0x3333333333333333333333333333333333333333",
    privyUserId: "did:privy:usr_new"
  });

  assert.equal(claimed.claimStatus, "claimed");
  assert.equal(claimed.ownerId, "did:privy:usr_new");
  assert.equal(identity.listUsers().length, 1);
  assert.equal(identity.getRecipient(pending.id)?.claimStatus, "claimed");
});

test("identity service seeds directory-backed claimed recipients into persistence", () => {
  const identity = createIdentityService({
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

  const resolved = identity.resolveRecipient({ email: "alice@gmail.com" });

  assert.equal(resolved.id, "rcp_alice");
  assert.equal(identity.getRecipient("rcp_alice")?.walletAddress, resolved.walletAddress);
});

test("identity service provisions a Privy wallet when a claimed recipient has no wallet address", async () => {
  const identity = createIdentityService({
    provisioner: {
      async provisionUserWallet({ privyUserId, email }) {
        assert.equal(privyUserId, "did:privy:usr_new");
        assert.equal(email, "new-user@gmail.com");
        return {
          walletAddress: "0x5555555555555555555555555555555555555555",
          walletId: "wallet_1"
        };
      }
    }
  });

  const pending = identity.resolveRecipient({ email: "new-user@gmail.com" });
  const claimed = await identity.claimRecipient(pending.id, {
    email: "new-user@gmail.com",
    privyUserId: "did:privy:usr_new"
  });

  assert.equal(claimed.walletAddress, "0x5555555555555555555555555555555555555555");
  assert.equal(claimed.claimStatus, "claimed");
});
