import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, isActiveRoute } from "../lib/navigation.ts";

test("NAV_ITEMS contains all 5 required primary consumer destinations", () => {
  const ids = NAV_ITEMS.map((item) => item.id);
  assert.deepEqual(ids, ["home", "money", "people", "activity", "settings"]);

  const hrefs = NAV_ITEMS.map((item) => item.href);
  assert.deepEqual(hrefs, ["/", "/money", "/people", "/activity", "/settings"]);
});

test("isActiveRoute correctly identifies active routes and subroutes", () => {
  // Home route
  assert.equal(isActiveRoute("/", "/"), true);
  assert.equal(isActiveRoute("/money", "/"), false);
  assert.equal(isActiveRoute("/people", "/"), false);

  // Trailing slash normalization
  assert.equal(isActiveRoute("/money/", "/money"), true);
  assert.equal(isActiveRoute("/money", "/money/"), true);

  // Subroutes
  assert.equal(isActiveRoute("/money/send", "/money"), true);
  assert.equal(isActiveRoute("/activity/pay_123", "/activity"), true);
  assert.equal(isActiveRoute("/settings/security", "/settings"), true);

  // Non-matching subpaths
  assert.equal(isActiveRoute("/money-extra", "/money"), false);
  assert.equal(isActiveRoute("/settings", "/money"), false);
});
