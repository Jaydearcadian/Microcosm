import test from "node:test";
import assert from "node:assert/strict";

import { createAlliumAdapter } from "../src/index.ts";

test("createAlliumAdapter builds an authenticated API client wrapper", async () => {
  const adapter = createAlliumAdapter({
    apiKey: "allium-api-key",
    apiUrl: "https://api.allium.so"
  });

  assert.equal(adapter.id, "allium");
  assert.equal(adapter.kind, "data");
  assert.equal(adapter.config.apiKey, "allium-api-key");
  assert.equal(adapter.config.apiUrl, "https://api.allium.so");
  assert.equal(typeof adapter.createClient, "function");

  const client = adapter.createClient();
  const request = client.buildRequest("/v1/query");

  assert.equal(request.url, "https://api.allium.so/v1/query");
  assert.equal(request.headers.Authorization, "Bearer allium-api-key");
});

test("createAlliumAdapter requires an api key", () => {
  assert.throws(() => createAlliumAdapter({ apiKey: "" }), {
    message: /Missing Allium API key/
  });
});
