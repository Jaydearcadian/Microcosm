import { createServer } from "node:http";

import { apiAppName, createApiAppAsync } from "./index.ts";
import { getRuntimeHealth } from "./health.ts";
import { getApiRuntimeConfig } from "./runtime.ts";
import {
  AuthError,
  authenticateAndAuthorize,
  getHeader,
  type AuthenticatedContext
} from "./auth.ts";
import {
  createPrivyTokenVerifier,
  type PrivyTokenVerifier
} from "../../../packages/adapters/privy/src/index.ts";

import { dispatchV1Request } from "./dispatcher.ts";

export type ApiServerOptions = Parameters<typeof createApiAppAsync>[0] & {
  auth?: {
    verifier?: PrivyTokenVerifier;
    jwtVerificationKey?: string;
    required?: boolean;
  };
};

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
  options: ApiServerOptions = {}
) => {
  const appPromise = createApiAppAsync(options);

  const verifier =
    options.auth?.verifier ??
    (process.env.PRIVY_APP_ID
      ? createPrivyTokenVerifier({
          appId: process.env.PRIVY_APP_ID,
          jwtVerificationKey:
            options.auth?.jwtVerificationKey ?? process.env.PRIVY_VERIFICATION_KEY
        })
      : undefined);

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

      // Delegate all /v1 endpoints to the centralized versioned dispatcher
      if (url.pathname.startsWith("/v1")) {
        const handled = await dispatchV1Request({
          request,
          response,
          app,
          verifier,
          options: {
            verifier
          }
        });
        if (handled) {
          return;
        }
      }

      // Authenticate and authorize protected routes
      const isPublicRoute =
        url.pathname === "/health" ||
        url.pathname === "/healthz" ||
        url.pathname === "/readyz";

      let authContext: AuthenticatedContext | undefined;
      const authRequired =
        options.auth?.required ?? (verifier !== undefined || url.pathname.startsWith("/v1"));

      if (!isPublicRoute && (authRequired || getHeader(request, "authorization"))) {
        if (!verifier) {
          return sendJson(response, 500, {
            error: "server_misconfiguration",
            detail: "Privy token verifier is not configured"
          });
        }

        authContext = await authenticateAndAuthorize(request, {
          verifier,
          identityService: app.users,
          spaceService: app.spaces,
          requestedSpaceId: getHeader(request, "x-space-id")
        });
      }

      const readJsonValidated = async () => {
        const data = (await readJson(request)) as Record<string, unknown>;
        if (authContext && data && typeof data === "object") {
          if (
            (typeof data.userId === "string" && data.userId !== authContext.principal.id) ||
            (typeof data.principalId === "string" && data.principalId !== authContext.principal.id)
          ) {
            throw new AuthError(
              403,
              "identity_mismatch",
              "Client-supplied principal ID does not match authenticated identity"
            );
          }
        }
        return data;
      };

      if (request.method === "GET" && url.pathname === "/v1/me") {
        if (!authContext) {
          return sendJson(response, 401, { error: "unauthorized" });
        }
        return sendJson(response, 200, {
          principal: {
            id: authContext.principal.id,
            email: authContext.principal.email,
            privyUserId: authContext.principal.privyUserId,
            walletAddress: authContext.principal.walletAddress
          },
          identities: [
            {
              provider: "privy",
              subject: authContext.providerSubject,
              linkedAt: new Date().toISOString(),
              identityType: "email"
            }
          ],
          activeSpace: {
            id: authContext.space.id,
            type: authContext.space.type,
            name: authContext.space.name,
            ownerUserId: authContext.space.ownerUserId
          }
        });
      }

      if (request.method === "GET" && url.pathname === "/v1/spaces") {
        if (!authContext) {
          return sendJson(response, 401, { error: "unauthorized" });
        }
        const userSpaces = await app.spaces.listSpacesForUser(authContext.principal.id);
        return sendJson(response, 200, userSpaces);
      }

      if (request.method === "GET" && /^\/v1\/spaces\/[^/]+$/.test(url.pathname)) {
        if (!authContext) {
          return sendJson(response, 401, { error: "unauthorized" });
        }
        const spaceId = url.pathname.split("/")[3]!;
        try {
          await app.spaces.requireActiveMembership(authContext.principal.id, spaceId);
          const space = await app.spaces.getSpace(spaceId);
          if (!space) {
            return sendNotFound(response, "space");
          }
          return sendJson(response, 200, space);
        } catch {
          return sendNotFound(response, "space");
        }
      }

      if (request.method === "POST" && url.pathname === "/recipients/resolve") {
        return sendJson(response, 200, await app.recipients.resolve((await readJsonValidated()) as never));
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
          await app.recipients.claim(recipientId, (await readJsonValidated()) as never)
        );
      }

      if (request.method === "POST" && url.pathname === "/envelopes") {
        return sendJson(
          response,
          200,
          await app.envelopes.create((await readJsonValidated()) as never)
        );
      }

      if (request.method === "GET" && url.pathname === "/envelopes") {
        return sendJson(response, 200, await app.envelopes.list());
      }

      if (request.method === "POST" && url.pathname === "/intents") {
        return sendJson(
          response,
          200,
          await app.intents.create((await readJsonValidated()) as never)
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
          await app.payments.create((await readJsonValidated()) as never)
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
          await app.payments.claim(paymentId, (await readJsonValidated()) as never)
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
      if (error instanceof AuthError) {
        return sendJson(response, error.status, error.toJSON());
      }
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
