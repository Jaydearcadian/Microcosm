import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { createApiApp } from "./index.ts";

test("api app persists email recipients and promotes pending recipients to claimed users", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "mcosm-recipients-"));
  const persistenceFile = path.join(directory, "state.json");

  try {
    const api = createApiApp({ persistenceFile });

    const pending = api.recipients.resolve({ email: "new-user@gmail.com" });
    assert.equal(pending.claimStatus, "pending-claim");
    assert.equal(api.recipients.get(pending.id)?.lookupKey, "new-user@gmail.com");

    const claimed = await api.recipients.claim(pending.id, {
      email: "new-user@gmail.com",
      walletAddress: "0x3333333333333333333333333333333333333333",
      privyUserId: "did:privy:usr_new"
    });

    assert.equal(claimed.claimStatus, "claimed");
    assert.equal(claimed.ownerType, "user");
    assert.equal(claimed.walletAddress, "0x3333333333333333333333333333333333333333");

    const reloaded = createApiApp({ persistenceFile });
    assert.equal(reloaded.recipients.get(pending.id)?.claimStatus, "claimed");
    assert.equal(reloaded.recipients.resolve({ email: "new-user@gmail.com" }).ownerId, "did:privy:usr_new");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
