import test from "node:test";
import assert from "node:assert/strict";

import { createAdapterRegistry } from "../src/index.ts";

test("createAdapterRegistry returns Arc payment and market adapters", () => {
  const registry = createAdapterRegistry();

  assert.equal(registry.settlement.arc.network, "arc");
  assert.equal(registry.identity.privy.kind, "identity");
  assert.equal(registry.communications.xmtp.kind, "communications");
  assert.equal(registry.marketData.polymarket.realtime, true);
  assert.equal(registry.marketData.hyperliquid.integration, "custom");
});

test("createAdapterRegistry lists first-class and custom venues separately", () => {
  const registry = createAdapterRegistry();

  assert.deepEqual(registry.marketData.firstClassVenues, [
    "myriad",
    "polymarket"
  ]);
  assert.deepEqual(registry.marketData.customVenues, [
    "hyperliquid",
    "lighter"
  ]);
});
