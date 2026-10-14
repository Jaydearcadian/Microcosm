import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApiClient, ApiClientError } from "../lib/api-client.ts";

test("api client attaches bearer token and space id headers", async () => {
  let capturedHeaders: Record<string, string | string[] | undefined> = {};

  const server = createServer((req, res) => {
    capturedHeaders = req.headers;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        user: { id: "usr_test", status: "active", createdAt: "", updatedAt: "" },
        identities: [],
        wallets: [],
        activeSpace: { id: "spc_test", type: "personal", name: "Personal Space", ownerUserId: "usr_test", status: "active", createdAt: "", updatedAt: "" }
      })
    );
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const client = createApiClient({
      baseUrl,
      getAccessToken: () => "mock-token-123",
      getSpaceId: () => "spc_custom_456"
    });

    const me = await client.getMe();
    assert.equal(me.user.id, "usr_test");
    assert.equal(capturedHeaders.authorization, "Bearer mock-token-123");
    assert.equal(capturedHeaders["x-space-id"], "spc_custom_456");
  } finally {
    server.close();
  }
});

test("api client handles 401 unauthorized and invokes callback", async () => {
  let unauthorizedCalled = false;

  const server = createServer((req, res) => {
    res.statusCode = 401;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "unauthorized", code: "token_expired", message: "Token has expired" }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const client = createApiClient({
      baseUrl,
      onUnauthorized: () => {
        unauthorizedCalled = true;
      }
    });

    await assert.rejects(
      async () => {
        await client.getMe();
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 401);
        assert.equal(err.code, "token_expired");
        return true;
      }
    );

    assert.equal(unauthorizedCalled, true);
  } finally {
    server.close();
  }
});

test("api client forwards idempotency key on mutating operations", async () => {
  let capturedKey: string | undefined;

  const server = createServer((req, res) => {
    capturedKey = req.headers["idempotency-key"] as string;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ intent: { id: "int_test" } }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const client = createApiClient({ baseUrl });
    await client.createIntent({ amount: "100" }, "idem_key_789");
    assert.equal(capturedKey, "idem_key_789");
  } finally {
    server.close();
  }
});
