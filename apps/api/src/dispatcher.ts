import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import {
  AuthError,
  authenticateAndAuthorize,
  getHeader,
  validateCallerOwnership,
  type AuthenticatedContext
} from "./auth.ts";
import type { createApiAppAsync } from "./index.ts";
import type { PrivyTokenVerifier } from "../../../packages/adapters/privy/src/index.ts";
import {
  createWalletLinkChallenge,
  verifyWalletLinkChallenge,
  type WalletLinkChallenge
} from "../../../packages/identity/src/index.ts";

export type ApiApp = Awaited<ReturnType<typeof createApiAppAsync>>;

export type DispatcherOptions = {
  verifier?: PrivyTokenVerifier;
  maxBodyBytes?: number;
};

export const MAX_BODY_BYTES = 100 * 1024; // 100KB limit for API payloads

export const rejectViewer = (
  authContext: AuthenticatedContext,
  action: string,
  requestId: string,
  response: ServerResponse
): boolean => {
  if (authContext.membership.role === "viewer") {
    sendJson(response, 403, {
      error: "forbidden",
      code: "forbidden",
      message: `Viewer role not permitted to ${action}`,
      requestId
    });
    return true;
  }
  return false;
};

export const sendJson = (
  response: ServerResponse,
  status: number,
  payload: unknown,
  headers: Record<string, string> = {}
) => {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  for (const [key, value] of Object.entries(headers)) {
    response.setHeader(key, value);
  }
  response.end(JSON.stringify(payload));
};

export const sendNotFound = (
  response: ServerResponse,
  resource: string,
  requestId: string
) => {
  const code = `${resource}_not_found`;
  return sendJson(response, 404, {
    error: code,
    code,
    message: `Resource '${resource}' not found in active space`,
    requestId
  });
};

export const sendMethodNotAllowed = (
  response: ServerResponse,
  allowedMethods: string[],
  pathname: string,
  method: string,
  requestId: string
) => {
  return sendJson(
    response,
    405,
    {
      error: "method_not_allowed",
      code: "method_not_allowed",
      message: `Method ${method} not allowed for ${pathname}. Allowed methods: ${allowedMethods.join(", ")}`,
      requestId
    },
    { Allow: allowedMethods.join(", ") }
  );
};

export const readJsonBody = async (
  request: IncomingMessage,
  maxBytes: number = MAX_BODY_BYTES,
  requestId: string
): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > maxBytes) {
      const err = new AuthError(
        413,
        "payload_too_large",
        `Request payload exceeds limit of ${maxBytes} bytes`
      );
      err.requestId = requestId;
      throw err;
    }
    chunks.push(buf);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch (err: unknown) {
    const parseErr = new AuthError(
      400,
      "invalid_json",
      "Malformed JSON payload in request body",
      err instanceof Error ? err.message : String(err)
    );
    parseErr.requestId = requestId;
    throw parseErr;
  }
};

type RouteDefinition = {
  pattern: RegExp;
  allowedMethods: string[];
  handler: (ctx: {
    request: IncomingMessage;
    response: ServerResponse;
    pathname: string;
    method: string;
    params: Record<string, string>;
    app: ApiApp;
    authContext: AuthenticatedContext;
    body: Record<string, unknown>;
    requestId: string;
  }) => Promise<void>;
};

export const routeTable: RouteDefinition[] = [
  // 1. /v1/me
  {
    pattern: /^\/v1\/me$/,
    allowedMethods: ["GET"],
    handler: async ({ response, authContext }) => {
      const now = new Date().toISOString();
      const userWallets = authContext.principal.walletAddress
        ? [
            {
              id: `wb_${authContext.principal.id}`,
              userId: authContext.principal.id,
              spaceId: authContext.space.id,
              address: authContext.principal.walletAddress.toLowerCase() as `0x${string}`,
              chainType: "evm" as const,
              chainId: 5042,
              role: "primary" as const,
              provider: "privy" as const,
              verification: "provider_attested" as const,
              status: "active" as const,
              createdAt: now
            }
          ]
        : [];

      return sendJson(response, 200, {
        user: {
          id: authContext.principal.id,
          status: "active",
          createdAt: now,
          updatedAt: now
        },
        principal: {
          id: authContext.principal.id,
          email: authContext.principal.email,
          privyUserId: authContext.principal.privyUserId,
          walletAddress: authContext.principal.walletAddress
        },
        identities: [
          {
            provider: "privy",
            providerSubject: authContext.providerSubject,
            identityType: "email",
            linkedAt: now
          }
        ],
        wallets: userWallets,
        activeSpace: {
          id: authContext.space.id,
          type: authContext.space.type,
          name: authContext.space.name,
          ownerUserId: authContext.space.ownerUserId,
          status: authContext.space.status,
          createdAt: authContext.space.createdAt,
          updatedAt: authContext.space.updatedAt
        }
      });
    }
  },

  // 2. /v1/spaces (list or create)
  {
    pattern: /^\/v1\/spaces$/,
    allowedMethods: ["GET", "POST"],
    handler: async ({ method, response, app, authContext, body }) => {
      if (method === "GET") {
        const userSpaces = await app.spaces.listSpacesForUser(authContext.principal.id);
        return sendJson(response, 200, userSpaces);
      }
      if (method === "POST") {
        const name = (body.name as string) || "New Space";
        const type = (body.type as "personal" | "shared") || "shared";
        const newSpace = app.spaces.createSpace
          ? await app.spaces.createSpace(authContext.principal.id, { name, type })
          : await app.spaces.ensurePersonalSpace(authContext.principal.id);
        return sendJson(response, 201, newSpace);
      }
    }
  },

  // 3. /v1/spaces/:id (get or delete)
  {
    pattern: /^\/v1\/spaces\/([^/]+)$/,
    allowedMethods: ["GET", "DELETE"],
    handler: async ({ method, response, app, authContext, params, requestId }) => {
      const spaceId = params[0]!;
      if (method === "GET") {
        try {
          await app.spaces.requireActiveMembership(authContext.principal.id, spaceId);
          const space = await app.spaces.getSpace(spaceId);
          if (!space) {
            return sendNotFound(response, "space", requestId);
          }
          return sendJson(response, 200, space);
        } catch {
          return sendNotFound(response, "space", requestId);
        }
      }
      if (method === "DELETE") {
        try {
          await app.spaces.requireActiveMembership(authContext.principal.id, spaceId);
        } catch {
          return sendNotFound(response, "space", requestId);
        }
        const space = await app.spaces.getSpace(spaceId);
        if (!space) {
          return sendNotFound(response, "space", requestId);
        }
        if (space.ownerUserId !== authContext.principal.id) {
          return sendJson(response, 403, {
            error: "forbidden",
            code: "forbidden",
            message: `Ownership of space ${spaceId} required for user ${authContext.principal.id}`,
            requestId
          });
        }
        return sendJson(response, 200, { ok: true, spaceId, status: "archived" });
      }
    }
  },

  // 4. /v1/balance
  {
    pattern: /^\/v1\/balance$/,
    allowedMethods: ["GET"],
    handler: async ({ response, authContext }) => {
      const walletAddress =
        authContext.principal.walletAddress || "0x0000000000000000000000000000000000000000";
      return sendJson(response, 200, {
        spaceId: authContext.space.id,
        address: walletAddress.toLowerCase() as `0x${string}`,
        chainId: 5042,
        asset: "USDC" as const,
        tokenAddress: "0x3600000000000000000000000000000000000000" as `0x${string}`,
        amountDecimal: "1000.00",
        amountBaseUnits: "1000000000",
        observedAt: new Date().toISOString(),
        source: "cached" as const
      });
    }
  },

  // 5. /v1/wallet
  {
    pattern: /^\/v1\/wallet$/,
    allowedMethods: ["GET"],
    handler: async ({ response, authContext }) => {
      const walletAddress = authContext.principal.walletAddress;
      const wallets = walletAddress
        ? [
            {
              id: `wb_${authContext.principal.id}`,
              userId: authContext.principal.id,
              spaceId: authContext.space.id,
              address: walletAddress.toLowerCase() as `0x${string}`,
              chainType: "evm" as const,
              chainId: 5042,
              role: "primary" as const,
              provider: "privy" as const,
              verification: "provider_attested" as const,
              status: "active" as const,
              createdAt: new Date().toISOString()
            }
          ]
        : [];
      return sendJson(response, 200, {
        wallet: wallets[0],
        wallets
      });
    }
  },

  // 5a. /v1/wallet/challenge
  {
    pattern: /^\/v1\/wallet\/challenge$/,
    allowedMethods: ["POST"],
    handler: async ({ response, app, authContext, body, requestId }) => {
      if (rejectViewer(authContext, "link wallets", requestId, response)) {
        return;
      }
      const address = body.address as string;
      if (!address || typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return sendJson(response, 400, {
          error: "invalid_address",
          code: "invalid_address",
          message: "A valid EVM address is required",
          requestId
        });
      }

      const challenge = createWalletLinkChallenge({
        userId: authContext.principal.id,
        spaceId: authContext.space.id,
        address
      });

      if (app.identity.saveWalletLinkChallenge) {
        await app.identity.saveWalletLinkChallenge(challenge);
      }

      return sendJson(response, 201, { challenge });
    }
  },

  // 5b. /v1/wallet/link
  {
    pattern: /^\/v1\/wallet\/link$/,
    allowedMethods: ["POST"],
    handler: async ({ response, app, authContext, body, requestId }) => {
      if (rejectViewer(authContext, "link wallets", requestId, response)) {
        return;
      }
      const challengeId = body.challengeId as string;
      const signature = body.signature as string;

      if (!challengeId || !signature) {
        return sendJson(response, 400, {
          error: "missing_parameter",
          code: "missing_parameter",
          message: "challengeId and signature are required",
          requestId
        });
      }

      let challenge: WalletLinkChallenge | undefined;
      if (app.identity.getWalletLinkChallenge) {
        challenge = await app.identity.getWalletLinkChallenge(challengeId);
      }

      if (!challenge) {
        return sendJson(response, 404, {
          error: "challenge_not_found",
          code: "challenge_not_found",
          message: "Wallet link challenge not found",
          requestId
        });
      }

      // Check tenant isolation: challenge must match authenticated principal and space
      if (challenge.userId !== authContext.principal.id || challenge.spaceId !== authContext.space.id) {
        return sendJson(response, 403, {
          error: "identity_mismatch",
          code: "identity_mismatch",
          message: "Challenge does not belong to the authenticated principal or space",
          requestId
        });
      }

      // Cryptographic signature verification
      const isValid = await verifyWalletLinkChallenge({
        challenge,
        signature
      });

      if (!isValid) {
        return sendJson(response, 400, {
          error: "invalid_signature",
          code: "invalid_signature",
          message: "Cryptographic signature verification failed",
          requestId
        });
      }

      // Consume challenge atomically (at most once)
      if (app.identity.consumeWalletLinkChallenge) {
        const consumed = await app.identity.consumeWalletLinkChallenge(challengeId);
        if (!consumed) {
          return sendJson(response, 409, {
            error: "challenge_already_consumed",
            code: "challenge_already_consumed",
            message: "Challenge has already been consumed or has expired",
            requestId
          });
        }
      }

      // Update principal's wallet
      authContext.principal.walletAddress = challenge.address;
      await (app.identity as any).repository?.upsertUser?.({
        id: authContext.principal.id,
        email: authContext.principal.email,
        privyUserId: authContext.principal.privyUserId,
        walletAddress: challenge.address
      });

      app.audit.record?.({
        id: `aud_wallet_${Date.now()}`,
        actorType: "user",
        actorId: authContext.principal.id,
        eventType: "wallet.linked",
        objectType: "wallet",
        objectId: `wb_${authContext.principal.id}`,
        spaceId: authContext.space.id,
        payload: {
          address: challenge.address,
          verification: "signature_verified"
        }
      });

      return sendJson(response, 200, {
        ok: true,
        wallet: {
          id: `wb_${authContext.principal.id}`,
          userId: authContext.principal.id,
          spaceId: authContext.space.id,
          address: challenge.address,
          chainType: "evm",
          chainId: 5042,
          role: "primary",
          provider: "external",
          verification: "signature_verified",
          status: "active",
          createdAt: new Date().toISOString()
        }
      });
    }
  },

  // 6. /v1/recipients/resolve
  {
    pattern: /^\/v1\/recipients\/resolve$/,
    allowedMethods: ["POST"],
    handler: async ({ response, app, authContext, body }) => {
      const resolved = await app.recipients.resolve(body as never);
      if (!resolved.spaceId) {
        resolved.spaceId = authContext.space.id;
        resolved.ownerUserId = authContext.principal.id;
      }
      return sendJson(response, 200, resolved);
    }
  },

  // 7. /v1/recipients (list or create)
  {
    pattern: /^\/v1\/recipients$/,
    allowedMethods: ["GET", "POST"],
    handler: async ({ method, response, app, authContext, body, requestId }) => {
      if (method === "GET") {
        const allRecipients = await app.recipients.list();
        const spaceRecipients = allRecipients.filter(
          (r) => !r.spaceId || r.spaceId === authContext.space.id
        );
        return sendJson(response, 200, spaceRecipients);
      }
      if (method === "POST") {
        if (rejectViewer(authContext, "create recipients", requestId, response)) {
          return;
        }
        const recipientType =
          (body.recipientType as "wallet" | "email" | "handle" | "agent") ||
          (body.address ? "wallet" : "email");
        const displayLabel =
          (body.displayLabel as string) ||
          (body.address as string) ||
          (body.email as string) ||
          "Recipient";

        const recipientService = app.recipients as {
          create?: (input: {
            id?: string;
            spaceId: string;
            ownerUserId: string;
            recipientType: "wallet" | "email" | "handle" | "agent";
            displayLabel: string;
            address?: string;
          }) => unknown;
          resolve: (input: unknown) => Promise<unknown> | unknown;
        };
        const recipient = recipientService.create
          ? recipientService.create({
              id: (body.id as string) || undefined,
              spaceId: authContext.space.id,
              ownerUserId: authContext.principal.id,
              recipientType,
              displayLabel,
              address: (body.address as string) || undefined
            })
          : await recipientService.resolve(body as never);

        return sendJson(response, 201, { recipient });
      }
    }
  },

  // 8. /v1/recipients/:id/claim
  {
    pattern: /^\/v1\/recipients\/([^/]+)\/claim$/,
    allowedMethods: ["POST"],
    handler: async ({ response, app, authContext, params, body, requestId }) => {
      if (rejectViewer(authContext, "claim recipients", requestId, response)) {
        return;
      }
      const recipientId = decodeURIComponent(params[0]!);
      const recipient = await app.recipients.get(recipientId);
      if (!recipient) {
        return sendNotFound(response, "recipient", requestId);
      }
      if (recipient.spaceId && recipient.spaceId !== authContext.space.id) {
        return sendNotFound(response, "recipient", requestId);
      }
      const claimed = await app.recipients.claim(recipientId, body as never);
      return sendJson(response, 200, claimed);
    }
  },

  // 9. /v1/recipients/:id
  {
    pattern: /^\/v1\/recipients\/([^/]+)$/,
    allowedMethods: ["GET"],
    handler: async ({ response, app, authContext, params, requestId }) => {
      const recipientId = decodeURIComponent(params[0]!);
      const recipient = await app.recipients.get(recipientId);
      if (!recipient) {
        return sendNotFound(response, "recipient", requestId);
      }
      if (recipient.spaceId && recipient.spaceId !== authContext.space.id) {
        return sendNotFound(response, "recipient", requestId);
      }
      return sendJson(response, 200, recipient);
    }
  },

  // 10. /v1/envelopes (list or create)
  {
    pattern: /^\/v1\/envelopes$/,
    allowedMethods: ["GET", "POST"],
    handler: async ({ method, response, app, authContext, body, requestId }) => {
      if (method === "GET") {
        const allEnvelopes = await app.envelopes.list();
        const spaceEnvelopes = allEnvelopes.filter(
          (e) => !e.spaceId || e.spaceId === authContext.space.id
        );
        return sendJson(response, 200, spaceEnvelopes);
      }
      if (method === "POST") {
        if (rejectViewer(authContext, "create envelopes", requestId, response)) {
          return;
        }
        const envelopeData = {
          ...body,
          id: (body.id as string) || `env_${randomBytes(8).toString("hex")}`,
          spaceId: authContext.space.id,
          ownerUserId: authContext.principal.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const created = app.envelopes.create(envelopeData as never);
        return sendJson(response, 201, created);
      }
    }
  },

  // 11. /v1/envelopes/:id
  {
    pattern: /^\/v1\/envelopes\/([^/]+)$/,
    allowedMethods: ["GET"],
    handler: async ({ response, app, authContext, params, requestId }) => {
      const envelopeId = params[0]!;
      const envelope = await app.envelopes.get(envelopeId);
      if (!envelope) {
        return sendNotFound(response, "envelope", requestId);
      }
      if (envelope.spaceId && envelope.spaceId !== authContext.space.id) {
        return sendNotFound(response, "envelope", requestId);
      }
      return sendJson(response, 200, envelope);
    }
  },

  // 12. /v1/intents (list or create)
  {
    pattern: /^\/v1\/intents$/,
    allowedMethods: ["GET", "POST"],
    handler: async ({ method, response, app, authContext, body, requestId }) => {
      if (method === "GET") {
        const allIntents = await app.intents.list();
        const spaceIntents = allIntents.filter(
          (i) => !i.spaceId || i.spaceId === authContext.space.id
        );
        return sendJson(response, 200, spaceIntents);
      }
      if (method === "POST") {
        if (rejectViewer(authContext, "create intents", requestId, response)) {
          return;
        }
        // Cross-tenant reference checks
        if (body.envelopeId && typeof body.envelopeId === "string") {
          const envelope = await app.envelopes.get(body.envelopeId);
          if (!envelope || (envelope.spaceId && envelope.spaceId !== authContext.space.id)) {
            return sendNotFound(response, "envelope", requestId);
          }
        }
        if (body.recipientId && typeof body.recipientId === "string") {
          const recipient = await app.recipients.get(body.recipientId);
          if (!recipient || (recipient.spaceId && recipient.spaceId !== authContext.space.id)) {
            return sendNotFound(response, "recipient", requestId);
          }
        }

        const intentInput = {
          ...body,
          spaceId: authContext.space.id,
          ownerUserId: authContext.principal.id,
          createdAt: new Date().toISOString()
        };

        const result = app.intents.create(intentInput as never);
        return sendJson(response, 201, result);
      }
    }
  },

  // 13. /v1/intents/:id
  {
    pattern: /^\/v1\/intents\/([^/]+)$/,
    allowedMethods: ["GET"],
    handler: async ({ response, app, authContext, params, requestId }) => {
      const intentId = params[0]!;
      const intent = await app.intents.get(intentId);
      if (!intent) {
        return sendNotFound(response, "intent", requestId);
      }
      if (intent.spaceId && intent.spaceId !== authContext.space.id) {
        return sendNotFound(response, "intent", requestId);
      }
      return sendJson(response, 200, intent);
    }
  },

  // 14. /v1/payments/prepare (strictly decoupled preparation stage)
  {
    pattern: /^\/v1\/payments\/prepare$/,
    allowedMethods: ["POST"],
    handler: async ({ response, app, authContext, body, requestId }) => {
      if (rejectViewer(authContext, "prepare payments", requestId, response)) {
        return;
      }
      const intentId = body.intentId as string;
      if (!intentId) {
        return sendNotFound(response, "intent", requestId);
      }
      const intent = await app.intents.get(intentId);
      if (
        !intent ||
        (intent.spaceId && intent.spaceId !== authContext.space.id) ||
        (intent.ownerUserId && intent.ownerUserId !== authContext.principal.id)
      ) {
        return sendNotFound(response, "intent", requestId);
      }

      if (intent.status !== "approved") {
        return sendJson(response, 400, {
          error: "intent_not_approved",
          code: "intent_not_approved",
          message: "Cannot prepare payment for an unapproved intent",
          requestId
        });
      }

      const senderAddress = (
        authContext.principal.walletAddress ||
        (body.senderAddress as string) ||
        "0x0000000000000000000000000000000000000001"
      ).toLowerCase() as `0x${string}`;

      let recipientAddress = intent.recipientAddress;
      if (!recipientAddress && intent.recipientId) {
        const rcp = await app.recipients.get(intent.recipientId);
        if (rcp && rcp.walletAddress) {
          recipientAddress = rcp.walletAddress;
        }
      }
      const to = (
        recipientAddress || "0x0000000000000000000000000000000000000002"
      ).toLowerCase() as `0x${string}`;

      const tokenAddress = (
        intent.tokenAddress || "0x3600000000000000000000000000000000000000"
      ).toLowerCase() as `0x${string}`;

      const amountBaseUnits =
        intent.amountBaseUnits || `${Math.round(Number(intent.amount || "0") * 1_000_000)}`;

      // Generate calldata: ERC-20 transfer(address to, uint256 value)
      const recipientClean = to.replace(/^0x/, "").padStart(64, "0");
      let amountHex = "0".repeat(64);
      try {
        amountHex = BigInt(amountBaseUnits).toString(16).padStart(64, "0");
      } catch {
        amountHex = "0".repeat(64);
      }
      const calldata = `0xa9059cbb${recipientClean}${amountHex}`;

      return sendJson(response, 200, {
        intentId: intent.id,
        senderAddress,
        to,
        calldata,
        value: "0" as const,
        chainId: intent.chainId || 5042,
        tokenAddress,
        amountBaseUnits,
        expiresAt: intent.expiresAt || new Date(Date.now() + 3600_000).toISOString()
      });
    }
  },

  // 15. /v1/payments/submission
  {
    pattern: /^\/v1\/payments\/submission$/,
    allowedMethods: ["POST"],
    handler: async ({ response, app, authContext, body, requestId }) => {
      if (rejectViewer(authContext, "submit payments", requestId, response)) {
        return;
      }
      const txHash = body.txHash as string | undefined;
      if (!txHash || typeof txHash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return sendJson(response, 400, {
          error: "invalid_tx_hash",
          code: "invalid_tx_hash",
          message: "A valid 32-byte hexadecimal transaction hash prefixed with 0x is required",
          requestId
        });
      }

      const paymentId = body.paymentId as string | undefined;
      const intentId = body.intentId as string | undefined;

      if (!paymentId && !intentId) {
        return sendJson(response, 400, {
          error: "missing_identifier",
          code: "missing_identifier",
          message: "Either paymentId or intentId is required for submission",
          requestId
        });
      }

      let payment: any;
      if (paymentId) {
        payment = await app.payments.get(paymentId);
        if (
          !payment ||
          (payment.spaceId && payment.spaceId !== authContext.space.id) ||
          (payment.ownerUserId && payment.ownerUserId !== authContext.principal.id)
        ) {
          return sendNotFound(response, "payment", requestId);
        }
      }

      const effectiveIntentId = payment?.intentId ?? intentId;
      if (effectiveIntentId) {
        const intent = await app.intents.get(effectiveIntentId);
        if (
          !intent ||
          (intent.spaceId && intent.spaceId !== authContext.space.id) ||
          (intent.ownerUserId && intent.ownerUserId !== authContext.principal.id)
        ) {
          return sendNotFound(response, "intent", requestId);
        }
        if (intent.status !== "approved") {
          return sendJson(response, 400, {
            error: "intent_not_approved",
            code: "intent_not_approved",
            message: "Cannot submit payment for an unapproved intent",
            requestId
          });
        }
      }

      // Check for global duplicate txHash across other payments
      const allPayments = await app.payments.list();
      const existingWithTx = allPayments.find(
        (p) => p.txHash?.toLowerCase() === txHash.toLowerCase() && p.id !== payment?.id
      );
      if (existingWithTx) {
        return sendJson(response, 409, {
          error: "duplicate_submission",
          code: "duplicate_submission",
          message: "Transaction hash has already been submitted for another payment",
          requestId
        });
      }

      if (payment) {
        if (payment.status === "submitted") {
          if (payment.txHash?.toLowerCase() === txHash.toLowerCase()) {
            return sendJson(response, 200, {
              ok: true,
              submission: {
                paymentId: payment.id,
                intentId: payment.intentId,
                txHash,
                chainId: body.chainId ?? payment.chainId ?? 5042,
                senderAddress: body.senderAddress ?? payment.senderAddress,
                status: "submitted"
              }
            });
          }
          return sendJson(response, 409, {
            error: "duplicate_submission",
            code: "duplicate_submission",
            message: "Payment already submitted with different transaction hash",
            requestId
          });
        }

        if (payment.status === "confirmed" || payment.status === "settled") {
          return sendJson(response, 409, {
            error: "invalid_state_transition",
            code: "invalid_state_transition",
            message: "Cannot submit transaction for payment that has already settled",
            requestId
          });
        }

        if (payment.status !== "prepared" && payment.status !== "ready_for_settlement") {
          return sendJson(response, 409, {
            error: "invalid_state_transition",
            code: "invalid_state_transition",
            message: `Cannot submit payment in status '${payment.status}'`,
            requestId
          });
        }

        await app.payments.transitionStatus?.(
          payment.id,
          [payment.status],
          "submitted",
          { txHash }
        ) ?? app.payments.update?.(payment.id, { status: "submitted", txHash });
        payment.status = "submitted";
        payment.txHash = txHash;
      } else if (effectiveIntentId) {
        const intent = await app.intents.get(effectiveIntentId);
        let recipient: any;
        if (intent?.recipientId) {
          recipient = await app.recipients.get(intent.recipientId);
        }
        const created = await app.payments.create({
          intentId: effectiveIntentId,
          amount: intent?.amount || "0",
          asset: intent?.asset || "USDC",
          recipient: recipient ?? {
            id: intent?.recipientId ?? "rcp_default",
            ownerType: "external",
            claimStatus: "claimed",
            lookupKey: "default"
          },
          spaceId: authContext.space.id,
          ownerUserId: authContext.principal.id,
          senderAddress: (body.senderAddress as string) || authContext.principal.walletAddress,
          recipientAddress: intent?.recipientAddress,
          chainId: (body.chainId as number) || intent?.chainId || 5042,
          tokenAddress: intent?.tokenAddress,
          amountDecimal: intent?.amountDecimal || intent?.amount,
          amountBaseUnits: intent?.amountBaseUnits,
          status: "submitted",
          txHash
        });
        payment = created.payment;
      }

      app.audit.record?.({
        id: `aud_sub_${Date.now()}`,
        actorType: "user",
        actorId: authContext.principal.id,
        eventType: "payment.submitted",
        objectType: "payment",
        objectId: payment?.id ?? effectiveIntentId,
        spaceId: authContext.space.id,
        payload: {
          txHash,
          intentId: effectiveIntentId,
          status: "submitted"
        }
      });

      return sendJson(response, 200, {
        ok: true,
        submission: {
          paymentId: payment?.id,
          intentId: effectiveIntentId,
          txHash,
          chainId: body.chainId ?? payment?.chainId ?? 5042,
          senderAddress: body.senderAddress ?? payment?.senderAddress ?? authContext.principal.walletAddress,
          status: "submitted"
        }
      });
    }
  },

  // 16. /v1/payments (list or create)
  {
    pattern: /^\/v1\/payments$/,
    allowedMethods: ["GET", "POST"],
    handler: async ({ method, response, app, authContext, body, requestId }) => {
      if (method === "GET") {
        const allPayments = await app.payments.list();
        const spacePayments = allPayments.filter(
          (p) => !p.spaceId || p.spaceId === authContext.space.id
        );
        return sendJson(response, 200, spacePayments);
      }
      if (method === "POST") {
        if (rejectViewer(authContext, "create payments", requestId, response)) {
          return;
        }
        const intentId = body.intentId as string;
        if (!intentId) {
          return sendNotFound(response, "intent", requestId);
        }
        const intent = await app.intents.get(intentId);
        if (
          !intent ||
          (intent.spaceId && intent.spaceId !== authContext.space.id) ||
          (intent.ownerUserId && intent.ownerUserId !== authContext.principal.id)
        ) {
          return sendNotFound(response, "intent", requestId);
        }

        if (intent.status !== "approved") {
          return sendJson(response, 400, {
            error: "intent_not_approved",
            code: "intent_not_approved",
            message: "Cannot create payment for an unapproved intent",
            requestId
          });
        }

        let recipient = body.recipient as any;
        if (!recipient && intent.recipientId) {
          recipient = await app.recipients.get(intent.recipientId);
        }
        if (recipient?.spaceId && recipient.spaceId !== authContext.space.id) {
          return sendNotFound(response, "recipient", requestId);
        }

        const paymentInput = {
          ...body,
          spaceId: authContext.space.id,
          ownerUserId: authContext.principal.id,
          status: (body.status as any) || "prepared",
          recipient: recipient ?? {
            id: intent.recipientId ?? "rcp_default",
            ownerType: "external",
            claimStatus: "pending-claim",
            lookupKey: "default"
          }
        };

        const result = await app.payments.create(paymentInput as never);
        return sendJson(response, 201, result);
      }
    }
  },

  // 17. /v1/payments/:id/submission
  {
    pattern: /^\/v1\/payments\/([^/]+)\/submission$/,
    allowedMethods: ["POST"],
    handler: async ({ response, app, authContext, params, body, requestId }) => {
      if (rejectViewer(authContext, "submit payments", requestId, response)) {
        return;
      }
      const paymentId = params[0]!;
      const payment = await app.payments.get(paymentId);
      if (
        !payment ||
        (payment.spaceId && payment.spaceId !== authContext.space.id) ||
        (payment.ownerUserId && payment.ownerUserId !== authContext.principal.id)
      ) {
        return sendNotFound(response, "payment", requestId);
      }

      const txHash = body.txHash as string | undefined;
      if (!txHash || typeof txHash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return sendJson(response, 400, {
          error: "invalid_tx_hash",
          code: "invalid_tx_hash",
          message: "A valid 32-byte hexadecimal transaction hash prefixed with 0x is required",
          requestId
        });
      }

      if (payment.intentId) {
        const intent = await app.intents.get(payment.intentId);
        if (intent && intent.status !== "approved") {
          return sendJson(response, 400, {
            error: "intent_not_approved",
            code: "intent_not_approved",
            message: "Associated intent is not approved",
            requestId
          });
        }
      }

      // Check for global duplicate txHash across other payments
      const allPayments = await app.payments.list();
      const existingWithTx = allPayments.find(
        (p) => p.txHash?.toLowerCase() === txHash.toLowerCase() && p.id !== payment.id
      );
      if (existingWithTx) {
        return sendJson(response, 409, {
          error: "duplicate_submission",
          code: "duplicate_submission",
          message: "Transaction hash has already been submitted for another payment",
          requestId
        });
      }

      if (payment.status === "submitted") {
        if (payment.txHash?.toLowerCase() === txHash.toLowerCase()) {
          return sendJson(response, 200, {
            ok: true,
            submission: {
              paymentId,
              intentId: payment.intentId,
              txHash,
              chainId: body.chainId ?? payment.chainId ?? 5042,
              senderAddress: body.senderAddress ?? payment.senderAddress,
              status: "submitted"
            }
          });
        }
        return sendJson(response, 409, {
          error: "duplicate_submission",
          code: "duplicate_submission",
          message: "Payment already submitted with different transaction hash",
          requestId
        });
      }

      if (payment.status === "confirmed" || payment.status === "settled") {
        return sendJson(response, 409, {
          error: "invalid_state_transition",
          code: "invalid_state_transition",
          message: "Cannot submit transaction for payment that has already settled",
          requestId
        });
      }

      if (payment.status !== "prepared" && payment.status !== "ready_for_settlement") {
        return sendJson(response, 409, {
          error: "invalid_state_transition",
          code: "invalid_state_transition",
          message: `Cannot submit payment in status '${payment.status}'`,
          requestId
        });
      }

      await app.payments.transitionStatus?.(
        paymentId,
        [payment.status],
        "submitted",
        { txHash }
      ) ?? app.payments.update?.(paymentId, { status: "submitted", txHash });
      payment.status = "submitted";
      payment.txHash = txHash;

      app.audit.record?.({
        id: `aud_sub_${Date.now()}`,
        actorType: "user",
        actorId: authContext.principal.id,
        eventType: "payment.submitted",
        objectType: "payment",
        objectId: paymentId,
        spaceId: authContext.space.id,
        payload: {
          txHash,
          intentId: payment.intentId,
          status: "submitted"
        }
      });

      return sendJson(response, 200, {
        ok: true,
        submission: {
          paymentId,
          intentId: payment.intentId,
          txHash,
          chainId: body.chainId ?? payment.chainId ?? 5042,
          senderAddress: body.senderAddress ?? payment.senderAddress,
          status: "submitted"
        }
      });
    }
  },

  // 18. /v1/payments/:id/execute
  {
    pattern: /^\/v1\/payments\/([^/]+)\/execute$/,
    allowedMethods: ["POST"],
    handler: async ({ response, app, authContext, params, requestId }) => {
      const paymentId = params[0]!;
      const payment = await app.payments.get(paymentId);
      if (!payment || (payment.spaceId && payment.spaceId !== authContext.space.id)) {
        return sendNotFound(response, "payment", requestId);
      }
      if (authContext.membership.role === "viewer") {
        return sendJson(response, 403, {
          error: "forbidden",
          code: "forbidden",
          message: "Viewer role does not have permission to execute payments",
          requestId
        });
      }
      return sendJson(response, 403, {
        error: "server_signing_disallowed",
        code: "server_signing_disallowed",
        message: "Server-side transaction signing is disallowed for consumer execution. Transactions must be executed via client-signed submissions bound to approved intents.",
        requestId
      });
    }
  },

  // 19. /v1/payments/:id/execute-async
  {
    pattern: /^\/v1\/payments\/([^/]+)\/execute-async$/,
    allowedMethods: ["POST"],
    handler: async ({ response, app, authContext, params, requestId }) => {
      const paymentId = params[0]!;
      const payment = await app.payments.get(paymentId);
      if (!payment || (payment.spaceId && payment.spaceId !== authContext.space.id)) {
        return sendNotFound(response, "payment", requestId);
      }
      if (authContext.membership.role === "viewer") {
        return sendJson(response, 403, {
          error: "forbidden",
          code: "forbidden",
          message: "Viewer role does not have permission to execute payments",
          requestId
        });
      }
      return sendJson(response, 403, {
        error: "server_signing_disallowed",
        code: "server_signing_disallowed",
        message: "Server-side transaction signing is disallowed for consumer execution. Transactions must be executed via client-signed submissions bound to approved intents.",
        requestId
      });
    }
  },

  // 20. /v1/payments/:id/confirm
  {
    pattern: /^\/v1\/payments\/([^/]+)\/confirm$/,
    allowedMethods: ["POST"],
    handler: async ({ response, app, authContext, params, requestId }) => {
      if (rejectViewer(authContext, "confirm payments", requestId, response)) {
        return;
      }
      const paymentId = params[0]!;
      const payment = await app.payments.get(paymentId);
      if (!payment || (payment.spaceId && payment.spaceId !== authContext.space.id)) {
        return sendNotFound(response, "payment", requestId);
      }
      if (payment.status === "confirmed") {
        return sendJson(response, 200, { ok: true, payment });
      }
      if (payment.status === "failed") {
        return sendJson(response, 409, {
          error: "invalid_state_transition",
          code: "invalid_state_transition",
          message: "Cannot confirm payment in failed state",
          requestId
        });
      }
      if (payment.status !== "submitted" && payment.status !== "confirming") {
        return sendJson(response, 409, {
          error: "invalid_state_transition",
          code: "invalid_state_transition",
          message: `Cannot confirm payment in status '${payment.status}'; must be 'submitted' or 'confirming'`,
          requestId
        });
      }

      if (app.confirmer && payment.txHash) {
        const confirmation = await app.confirmer(payment.txHash);
        if (!confirmation.confirmed) {
          return sendJson(response, 409, {
            error: "unconfirmed_transaction",
            code: "unconfirmed_transaction",
            message: "Transaction receipt has not been confirmed onchain",
            requestId
          });
        }
      }

      await app.payments.transitionStatus?.(
        paymentId,
        [payment.status],
        "confirmed"
      ) ?? app.payments.update?.(paymentId, { status: "confirmed" });
      payment.status = "confirmed";

      app.audit.record?.({
        id: `aud_conf_${Date.now()}`,
        actorType: "system",
        actorId: "confirmer",
        eventType: "payment.confirmed",
        objectType: "payment",
        objectId: paymentId,
        spaceId: authContext.space.id,
        payload: {
          txHash: payment.txHash,
          status: "confirmed"
        }
      });

      return sendJson(response, 200, { ok: true, payment });
    }
  },

  // 20. /v1/payments/:id/claim
  {
    pattern: /^\/v1\/payments\/([^/]+)\/claim$/,
    allowedMethods: ["POST"],
    handler: async ({ response, app, authContext, params, body, requestId }) => {
      if (rejectViewer(authContext, "claim payments", requestId, response)) {
        return;
      }
      const paymentId = params[0]!;
      const payment = await app.payments.get(paymentId);
      if (!payment || (payment.spaceId && payment.spaceId !== authContext.space.id)) {
        return sendNotFound(response, "payment", requestId);
      }
      const claimed = await app.payments.claim(paymentId, body as never);
      return sendJson(response, 200, claimed);
    }
  },

  // 21. /v1/payments/:id
  {
    pattern: /^\/v1\/payments\/([^/]+)$/,
    allowedMethods: ["GET"],
    handler: async ({ response, app, authContext, params, requestId }) => {
      const paymentId = params[0]!;
      const payment = await app.payments.get(paymentId);
      if (!payment || (payment.spaceId && payment.spaceId !== authContext.space.id)) {
        return sendNotFound(response, "payment", requestId);
      }
      return sendJson(response, 200, payment);
    }
  },

  // 22. /v1/activity
  {
    pattern: /^\/v1\/activity$/,
    allowedMethods: ["GET"],
    handler: async ({ response, app, authContext }) => {
      const rawAuditEvents = await app.audit.list();
      const auditEvents = Array.isArray(rawAuditEvents) ? rawAuditEvents : [];
      const spaceEvents = auditEvents.filter(
        (e: { spaceId?: string }) => !e.spaceId || e.spaceId === authContext.space.id
      );
      const items = spaceEvents.map((e: { id?: string; eventType: string; objectType: string; timestamp?: string; payload: Record<string, unknown> }, idx: number) => ({
        id: e.id || `act_${idx}`,
        spaceId: authContext.space.id,
        type: "payment_confirmed" as const,
        title: e.eventType,
        subtitle: e.objectType,
        timestamp: e.timestamp ?? new Date().toISOString(),
        status: "completed",
        details: e.payload
      }));
      return sendJson(response, 200, {
        items,
        nextCursor: null
      });
    }
  }
];

export const dispatchV1Request = async ({
  request,
  response,
  app,
  verifier,
  options = {}
}: {
  request: IncomingMessage;
  response: ServerResponse;
  app: ApiApp;
  verifier?: PrivyTokenVerifier;
  options?: DispatcherOptions;
}): Promise<boolean> => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname = url.pathname;
  const method = request.method ?? "GET";

  if (!pathname.startsWith("/v1")) {
    return false;
  }

  const requestId =
    getHeader(request, "x-request-id") || `req_${randomBytes(8).toString("hex")}`;
  response.setHeader("x-request-id", requestId);

  // 1. Find matching route pattern
  let matchedRoute: RouteDefinition | undefined;
  let matchParams: string[] = [];

  for (const route of routeTable) {
    const match = pathname.match(route.pattern);
    if (match) {
      matchedRoute = route;
      matchParams = match.slice(1);
      break;
    }
  }

  // 2. If no route matches, return 404 route_not_found
  if (!matchedRoute) {
    sendJson(response, 404, {
      error: "route_not_found",
      code: "route_not_found",
      message: `Route ${method} ${pathname} not found`,
      requestId
    });
    return true;
  }

  // 3. If method is not allowed, return 405 Method Not Allowed
  if (!matchedRoute.allowedMethods.includes(method)) {
    sendMethodNotAllowed(response, matchedRoute.allowedMethods, pathname, method, requestId);
    return true;
  }

  // 4. Authenticate and authorize request
  if (!verifier) {
    sendJson(response, 500, {
      error: "server_misconfiguration",
      code: "server_misconfiguration",
      message: "Privy token verifier is not configured",
      requestId
    });
    return true;
  }

  let authContext: AuthenticatedContext;
  try {
    authContext = await authenticateAndAuthorize(request, {
      verifier,
      identityService: app.users,
      spaceService: app.spaces,
      requestedSpaceId: getHeader(request, "x-space-id")
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      err.requestId = err.requestId || requestId;
      sendJson(response, err.status, err.toJSON());
      return true;
    }
    throw err;
  }

  // 5. Read body (with size limit and JSON parse validation) if method sends body
  let body: Record<string, unknown> = {};
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    try {
      body = await readJsonBody(request, options.maxBodyBytes ?? MAX_BODY_BYTES, requestId);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        err.requestId = err.requestId || requestId;
        sendJson(response, err.status, err.toJSON());
        return true;
      }
      throw err;
    }

    // 6. Security guard: Validate caller ownership recursively on request body
    try {
      validateCallerOwnership(body, authContext.principal.id);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        err.requestId = err.requestId || requestId;
        sendJson(response, err.status, err.toJSON());
        return true;
      }
      throw err;
    }

    // 7. Security guard: If body specifies spaceId, verify caller has active membership in that space
    if (body.spaceId && typeof body.spaceId === "string" && body.spaceId !== authContext.space.id) {
      try {
        await app.spaces.requireActiveMembership(authContext.principal.id, body.spaceId);
      } catch {
        sendJson(response, 404, {
          error: "space_not_found",
          code: "space_not_found",
          message: `Requested space not found`,
          requestId
        });
        return true;
      }
    }
  }

  // 8. Idempotency handling for mutating requests
  const idempotencyKey = (
    getHeader(request, "idempotency-key") ||
    (typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined)
  ) as string | undefined;

  let requestHash: string | undefined;
  if (idempotencyKey && app.idempotency) {
    const canonicalBody = JSON.stringify(body, Object.keys(body).sort());
    requestHash = createHash("sha256").update(canonicalBody).digest("hex");
    const existing = await app.idempotency.get(authContext.principal.id, pathname, idempotencyKey);
    if (existing) {
      if (existing.requestHash === requestHash) {
        sendJson(response, existing.statusCode, existing.responseBody, {
          "idempotency-replayed": "true"
        });
        return true;
      }
      sendJson(response, 409, {
        error: "idempotency_conflict",
        code: "idempotency_conflict",
        message: "Idempotency key reused with different request payload",
        requestId
      });
      return true;
    }

    const originalEnd = response.end.bind(response);
    let captured = false;
    response.end = function (chunk?: unknown, ...args: unknown[]) {
      if (!captured && response.statusCode >= 200 && response.statusCode < 300 && chunk) {
        captured = true;
        try {
          const parsed = JSON.parse(
            Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk)
          );
          void app.idempotency?.save({
            key: idempotencyKey,
            principalId: authContext.principal.id,
            route: pathname,
            requestHash: requestHash!,
            statusCode: response.statusCode,
            responseBody: parsed,
            createdAt: new Date().toISOString()
          });
        } catch {}
      }
      return (originalEnd as Function)(chunk, ...args);
    };
  }

  // 9. Execute route handler
  try {
    await matchedRoute.handler({
      request,
      response,
      pathname,
      method,
      params: matchParams as any,
      app,
      authContext,
      body,
      requestId
    });
    return true;
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      err.requestId = err.requestId || requestId;
      sendJson(response, err.status, err.toJSON());
      return true;
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    sendJson(response, 500, {
      error: "internal_error",
      code: "internal_error",
      message,
      requestId
    });
    return true;
  }
};
