import test from "node:test";
import assert from "node:assert/strict";

import { createXmtpAdapter } from "../src/index.ts";

test("createXmtpAdapter builds XMTP runtime config", () => {
  const adapter = createXmtpAdapter({
    env: "dev",
    dbPath: "./.data/xmtp.db3"
  });

  assert.equal(adapter.id, "xmtp");
  assert.equal(adapter.kind, "communications");
  assert.equal(adapter.config.env, "dev");
  assert.equal(adapter.config.dbPath, "./.data/xmtp.db3");
  assert.equal(typeof adapter.createClient, "function");
});

test("createXmtpAdapter defaults to dev env", () => {
  const adapter = createXmtpAdapter({});

  assert.equal(adapter.config.env, "dev");
});
