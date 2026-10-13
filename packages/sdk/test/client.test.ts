import test from "node:test";
import assert from "node:assert/strict";

import { createClient } from "../src/index.ts";

test("createClient composes runtime config and adapters for microcosm", () => {
  const client = createClient({
    ARC_TESTNET_RPC_URL: "https://rpc.testnet.arc.network",
    PRIVY_APP_ID: "privy-app-id",
    PRIVY_APP_SECRET: "privy-app-secret",
    XMTP_ENV: "dev",
    XMTP_DB_PATH: "./.data/xmtp.db3",
    ALLIUM_API_KEY: "allium-api-key",
    ALLIUM_API_URL: "https://api.allium.so",
    ENABLED_MARKETS: "myriad,polymarket"
  });

  assert.equal(client.config.arc.network, "testnet");
  assert.equal(client.adapters.identity.privy.config.appId, "privy-app-id");
  assert.equal(client.adapters.communications.xmtp.config.dbPath, "./.data/xmtp.db3");
  assert.equal(client.adapters.data.allium.config.apiKey, "allium-api-key");
  assert.deepEqual(client.config.markets.enabled, ["myriad", "polymarket"]);
});
