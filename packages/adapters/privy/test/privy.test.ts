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
