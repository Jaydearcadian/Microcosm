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

test("createRuntimeConfig resolves Arc mainnet with chain ID 5042 and verified USDC address", () => {
  const config = createRuntimeConfig({
    ARC_NETWORK: "mainnet",
    ARC_MAINNET_RPC_URL: "https://rpc.mainnet.arc.io/"
  });

  assert.equal(config.arc.network, "mainnet");
  assert.equal(config.arc.chainId, 5042);
  assert.equal(config.arc.rpcUrl, "https://rpc.mainnet.arc.io/");
  assert.equal(config.arc.usdcAddress, "0x3600000000000000000000000000000000000000");
});

test("createRuntimeConfig rejects invalid network typo and chainId mismatch", () => {
  assert.throws(
    () =>
      createRuntimeConfig({
        ARC_NETWORK: "devnet"
      }),
    /Unsupported ARC_NETWORK: devnet/
  );

  assert.throws(
    () =>
      createRuntimeConfig({
        ARC_NETWORK: "mainnet",
        ARC_CHAIN_ID: "5042002" // testnet chain ID for mainnet
      }),
    /does not match network mainnet expected chain ID 5042/
  );
});

