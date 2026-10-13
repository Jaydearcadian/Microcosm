import test from "node:test";
import assert from "node:assert/strict";

import { resolveRecipient } from "../src/index.ts";

test("resolveRecipient returns a claimed user recipient for a known email", () => {
  const recipient = resolveRecipient(
    {
      email: "alice@gmail.com"
    },
    {
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
  );

  assert.equal(recipient.id, "rcp_alice");
  assert.equal(recipient.walletAddress, "0x1111111111111111111111111111111111111111");
  assert.equal(recipient.claimStatus, "claimed");
});

test("resolveRecipient returns a claimable placeholder for an unknown email", () => {
  const recipient = resolveRecipient(
    {
      email: "new-user@gmail.com"
    },
    {
      emails: {}
    }
  );

  assert.equal(recipient.ownerType, "external");
  assert.equal(recipient.claimStatus, "pending-claim");
  assert.equal(recipient.lookupKey, "new-user@gmail.com");
});

test("resolveRecipient returns an agent recipient for an agent id", () => {
  const recipient = resolveRecipient(
    {
      agentId: "agt_payroll"
    },
    {
      agents: {
        agt_payroll: {
          id: "rcp_agent_payroll",
          ownerType: "agent",
          ownerId: "agt_payroll",
          walletAddress: "0x2222222222222222222222222222222222222222",
          claimStatus: "claimed"
        }
      }
    }
  );

  assert.equal(recipient.ownerType, "agent");
  assert.equal(recipient.ownerId, "agt_payroll");
});
