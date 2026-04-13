import { createServer } from "node:http";

import { apiAppName, createApiAppAsync } from "./index.ts";
import { getRuntimeHealth } from "./health.ts";
import { getApiRuntimeConfig } from "./runtime.ts";

const readJson = async (request: AsyncIterable<Buffer>): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
};

const sendJson = (
  response: import("node:http").ServerResponse,
  status: number,
  payload: unknown
) => {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
};

const sendNotFound = (
  response: import("node:http").ServerResponse,
  resource: string
) => sendJson(response, 404, { error: `${resource}_not_found` });

export const createApiServer = (
  options: Parameters<typeof createApiAppAsync>[0] = {}
) => {
  const appPromise = createApiAppAsync(options);

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    try {
      const app = await appPromise;

      if (request.method === "GET" && url.pathname === "/health") {
        return sendJson(response, 200, { ok: true, service: apiAppName });
      }

      if (request.method === "GET" && url.pathname === "/healthz") {
        const config = getApiRuntimeConfig();
        const report = await getRuntimeHealth({
          databaseUrl: config.databaseUrl,
          arcRpcUrl: config.arcRpcUrl
        });
        return sendJson(response, report.status === "ok" ? 200 : 503, report);
      }

      if (request.method === "GET" && url.pathname === "/readyz") {
        const config = getApiRuntimeConfig();
        const report = await getRuntimeHealth({
          databaseUrl: config.databaseUrl,
          arcRpcUrl: config.arcRpcUrl
        });
        return sendJson(response, report.status === "ok" ? 200 : 503, report);
      }

      if (request.method === "POST" && url.pathname === "/recipients/resolve") {
        return sendJson(response, 200, await app.recipients.resolve((await readJson(request)) as never));
      }

      if (request.method === "GET" && url.pathname === "/recipients") {
        return sendJson(response, 200, await app.recipients.list());
      }

      if (request.method === "GET" && /^\/recipients\/[^/]+$/.test(url.pathname)) {
        const recipientId = decodeURIComponent(url.pathname.split("/")[2]!);
        const recipient = await app.recipients.get(recipientId);
        return recipient
          ? sendJson(response, 200, recipient)
          : sendNotFound(response, "recipient");
      }

      if (request.method === "POST" && /^\/recipients\/[^/]+\/claim$/.test(url.pathname)) {
        const recipientId = decodeURIComponent(url.pathname.split("/")[2]!);
        return sendJson(
          response,
          200,
          await app.recipients.claim(recipientId, (await readJson(request)) as never)
        );
      }

      if (request.method === "POST" && url.pathname === "/envelopes") {
        return sendJson(
          response,
          200,
          await app.envelopes.create((await readJson(request)) as never)
        );
      }

      if (request.method === "GET" && url.pathname === "/envelopes") {
        return sendJson(response, 200, await app.envelopes.list());
      }

      if (request.method === "POST" && url.pathname === "/intents") {
        return sendJson(
          response,
          200,
          await app.intents.create((await readJson(request)) as never)
        );
      }

      if (request.method === "GET" && url.pathname === "/intents") {
        return sendJson(response, 200, await app.intents.list());
      }

      if (request.method === "GET" && /^\/intents\/[^/]+$/.test(url.pathname)) {
        const intentId = url.pathname.split("/")[2]!;
        const intent = await app.intents.get(intentId);
        return intent ? sendJson(response, 200, intent) : sendNotFound(response, "intent");
      }

      if (request.method === "POST" && url.pathname === "/payments") {
        return sendJson(
          response,
          200,
          await app.payments.create((await readJson(request)) as never)
        );
      }

      if (request.method === "GET" && url.pathname === "/payments") {
        return sendJson(response, 200, await app.payments.list());
      }

      if (request.method === "GET" && /^\/payments\/[^/]+$/.test(url.pathname)) {
        const paymentId = url.pathname.split("/")[2]!;
        const payment = await app.payments.get(paymentId);
        return payment
          ? sendJson(response, 200, payment)
          : sendNotFound(response, "payment");
      }

      if (request.method === "POST" && /^\/payments\/[^/]+\/execute$/.test(url.pathname)) {
        const paymentId = url.pathname.split("/")[2]!;
        return sendJson(response, 200, await app.payments.execute(paymentId));
      }

      if (request.method === "POST" && /^\/payments\/[^/]+\/execute-async$/.test(url.pathname)) {
        const paymentId = url.pathname.split("/")[2]!;
        return sendJson(response, 200, await app.payments.executeAsync(paymentId));
      }

      if (request.method === "POST" && /^\/payments\/[^/]+\/claim$/.test(url.pathname)) {
        const paymentId = url.pathname.split("/")[2]!;
        return sendJson(
          response,
          200,
          await app.payments.claim(paymentId, (await readJson(request)) as never)
        );
      }

      if (request.method === "GET" && url.pathname === "/settlements") {
        return sendJson(response, 200, await app.settlements.list());
      }

      if (request.method === "GET" && /^\/settlements\/[^/]+$/.test(url.pathname)) {
        const paymentId = url.pathname.split("/")[2]!;
        const settlement = await app.settlements.get(paymentId);
        return settlement
          ? sendJson(response, 200, settlement)
          : sendNotFound(response, "settlement");
      }

      if (request.method === "GET" && url.pathname === "/notifications") {
        return sendJson(response, 200, await app.notifications.list());
      }

      if (request.method === "GET" && url.pathname === "/jobs") {
        return sendJson(response, 200, await app.jobs.list());
      }

      sendJson(response, 404, { error: "not_found" });
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "unknown_error"
      });
    }
  });

  return {
    app: appPromise,
    url: "",
    async start(port = 0, host = "127.0.0.1") {
      await new Promise<void>((resolve) =>
        server.listen(port, host, () => resolve())
      );
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Could not resolve server address");
      }
      this.url = `http://${host}:${address.port}`;
    },
    async stop() {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  };
};
