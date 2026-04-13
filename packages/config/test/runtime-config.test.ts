import test from "node:test";
import assert from "node:assert/strict";

import { createRuntimeConfig } from "../src/index.ts";

test("createRuntimeConfig normalizes Arc env and supported venues", () => {
  const config = createRuntimeConfig({
    ARC_NETWORK: "testnet",
    ARC_TESTNET_RPC_URL: "https://rpc.testnet.arc.network",
    PRIVY_APP_ID: "privy-app",
    XMTP_ENV: "dev",
    ENABLED_MARKETS: "myriad,polymarket,hyperliquid,lighter"
  });

  assert.equal(config.arc.network, "testnet");
  assert.equal(config.arc.rpcUrl, "https://rpc.testnet.arc.network");
  assert.deepEqual(config.markets.enabled, [
    "myriad",
    "polymarket",
    "hyperliquid",
    "lighter"
  ]);
  assert.equal(config.identity.privyAppId, "privy-app");
  assert.equal(config.communications.xmtpEnv, "dev");
});

test("createRuntimeConfig rejects unsupported market adapters", () => {
  assert.throws(
    () =>
      createRuntimeConfig({
        ARC_TESTNET_RPC_URL: "https://rpc.testnet.arc.network",
        ENABLED_MARKETS: "myriad,unknown"
      }),
    /Unsupported market adapter: unknown/
  );
});
