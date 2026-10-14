import type { IncomingHttpHeaders } from "node:http";
import type { UserRecord, IdentityService } from "../../../packages/identity/src/index.ts";
import type { Space, SpaceMembership, SpaceService } from "../../../packages/spaces/src/index.ts";
import type { PrivyTokenVerifier, PrivyTokenClaims } from "../../../packages/adapters/privy/src/index.ts";

export class AuthError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: string;

  constructor(status: number, code: string, message: string, detail?: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }

  toJSON() {
    return {
      error: this.code,
      detail: this.detail ?? this.message,
      code: this.code
    };
  }
}

export type RequestLike = {
  headers?: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
  url?: string;
  method?: string;
};

export type VerifiedPrincipal = {
  userId: string;
  providerSubject: string;
};

export type AuthenticatedContext = {
  principal: UserRecord;
  providerSubject: string;
  sessionId: string;
  personalSpace: Space;
  space: Space;
  membership: SpaceMembership;
};

export type AuthenticateAndAuthorizeOptions = {
  verifier: PrivyTokenVerifier;
  identityService: IdentityService;
  spaceService: SpaceService;
  requestedSpaceId?: string;
  requiredRole?: "owner" | "admin" | "member";
  clientSuppliedIdentity?: {
    userId?: string;
    principalId?: string;
    spaceId?: string;
  };
};

export const getHeader = (request: RequestLike, name: string): string | undefined => {
  if (!request.headers) return undefined;
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(request.headers)) {
    if (key.toLowerCase() === target) {
      if (Array.isArray(value)) return value[0];
      return value;
    }
  }
  return undefined;
};

export const extractBearerToken = (authorizationHeader?: string): string => {
  if (!authorizationHeader || !authorizationHeader.trim()) {
    throw new AuthError(401, "unauthorized", "Missing Authorization header");
  }

  const parts = authorizationHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer" || !parts[1]) {
    throw new AuthError(
      401,
      "invalid_token",
      "Malformed authorization header: expected Bearer token"
    );
  }

  return parts[1];
};

export const verifyRequestPrincipal = async (
  request: RequestLike,
  verifier: PrivyTokenVerifier,
  identityService?: IdentityService
): Promise<VerifiedPrincipal> => {
  const token = extractBearerToken(getHeader(request, "authorization"));

  let claims: PrivyTokenClaims;
  try {
    claims = await verifier.verifyAccessToken(token);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to verify authentication token";
    if (msg.includes("expired")) {
      throw new AuthError(401, "token_expired", "Authentication token has expired", msg);
    }
    throw new AuthError(401, "invalid_token", "Invalid authentication token", msg);
  }

  if (identityService) {
    const resolution = await identityService.resolveOrCreatePrincipal({
      externalIdentity: {
        provider: "privy",
        subject: claims.user_id,
        linkedAt: new Date(claims.issued_at * 1000).toISOString()
      }
    });
    return {
      userId: resolution.user.id,
      providerSubject: claims.user_id
    };
  }

  return {
    userId: claims.user_id,
    providerSubject: claims.user_id
  };
};

export const authenticateAndAuthorize = async (
  request: RequestLike,
  options: AuthenticateAndAuthorizeOptions
): Promise<AuthenticatedContext> => {
  const token = extractBearerToken(getHeader(request, "authorization"));

  // 1. Verify session token server-side
  let claims: PrivyTokenClaims;
  try {
    claims = await options.verifier.verifyAccessToken(token);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to verify authentication token";
    if (msg.includes("expired")) {
      throw new AuthError(401, "token_expired", "Authentication token has expired", msg);
    }
    throw new AuthError(401, "invalid_token", "Invalid authentication token", msg);
  }

  // 2. Resolve canonical principal (stable, internal principal decoupled from login provider/wallet)
  let user: UserRecord;
  try {
    const resolution = await options.identityService.resolveOrCreatePrincipal({
      externalIdentity: {
        provider: "privy",
        subject: claims.user_id,
        linkedAt: new Date(claims.issued_at * 1000).toISOString()
      }
    });
    user = resolution.user;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Database error";
    throw new AuthError(500, "database_error", "Failed to resolve canonical principal", msg);
  }

  // 3. Security guard: Client-supplied identity fields must not conflict with verified principal
  const clientPrincipal =
    options.clientSuppliedIdentity?.principalId ??
    options.clientSuppliedIdentity?.userId ??
    getHeader(request, "x-principal-id");

  if (clientPrincipal && clientPrincipal !== user.id) {
    throw new AuthError(
      403,
      "identity_mismatch",
      "Client-supplied principal ID does not match verified session identity"
    );
  }

  // 4. Ensure personal Space (idempotent)
  let personalSpace: Space;
  try {
    personalSpace = await options.spaceService.ensurePersonalSpace(user.id);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Database error";
    throw new AuthError(500, "database_error", "Failed to resolve personal space", msg);
  }

  // 5. Determine target Space
  const requestedSpaceId =
    options.requestedSpaceId ??
    options.clientSuppliedIdentity?.spaceId ??
    getHeader(request, "x-space-id") ??
    personalSpace.id;

  // Personal space access
  if (requestedSpaceId === personalSpace.id) {
    const membership = await options.spaceService.requireActiveMembership(
      user.id,
      personalSpace.id
    );
    return {
      principal: user,
      providerSubject: claims.user_id,
      sessionId: claims.session_id,
      personalSpace,
      space: personalSpace,
      membership
    };
  }

  // Non-personal / requested space access: check existence without leaking existence to unauthorized users
  const targetSpace = await options.spaceService.getSpace(requestedSpaceId);
  if (!targetSpace) {
    throw new AuthError(404, "space_not_found", "Requested space not found");
  }

  let membership: SpaceMembership;
  try {
    membership = await options.spaceService.requireActiveMembership(
      user.id,
      requestedSpaceId
    );
  } catch {
    // If not a member, return 404 to avoid leaking whether another user's space exists
    throw new AuthError(404, "space_not_found", "Requested space not found");
  }

  if (membership.status !== "active") {
    throw new AuthError(403, "forbidden", "Active membership required");
  }

  if (options.requiredRole === "owner" && targetSpace.ownerUserId !== user.id) {
    throw new AuthError(403, "forbidden", "Ownership of space required for this operation");
  }

  return {
    principal: user,
    providerSubject: claims.user_id,
    sessionId: claims.session_id,
    personalSpace,
    space: targetSpace,
    membership
  };
};
