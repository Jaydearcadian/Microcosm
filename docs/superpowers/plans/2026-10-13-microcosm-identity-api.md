# Microcosm Identity and API Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. TDD is required for every behavior change.

**Goal:** Give Microcosm a stable internal identity and personal Space, authenticated `/v1` API operations, ownership enforcement, and durable application state.

**Architecture:** Treat Privy as the external authentication/wallet adapter, not as the Microcosm identity database. Verify provider tokens on the server, resolve them to an internal principal, and authorize every user-owned operation through database-backed membership/resource ownership. Keep domain rules in packages rather than HTTP handlers.

**Tech Stack:** Existing Node.js HTTP server, TypeScript, Zod 4, `@privy-io/node`, PostgreSQL, existing domain packages and Node test runner.

**Spec:** `docs/MICROCOSM_TECHNICAL_SPEC.md` §§2, 3.2–3.4, 5–7, 9–10, 13–14.

## Global Constraints

- Do not trust `userId`, `privyUserId`, `ownerId`, `spaceId` or wallet address supplied by the client as proof of ownership.
- A verified external identity maps to one stable internal `user.id`; re-login/linking must be idempotent.
- Personal Space creation and membership assignment must be one database transaction or equivalent atomic operation.
- Do not silently merge principals based on mutable email alone.
- Do not log bearer tokens, email lookup secrets or provider credentials.
- Every write that can be retried needs a stable idempotency strategy.
- Preserve test injection seams; do not make unit tests require live Privy or Postgres.


## Review Focus

1. Repeated login with one Privy subject must return the same internal user; covered in Task 3 tests `repeated provider subject returns same principal` and `email change preserves principal ID`.
2. Two concurrent first logins must not create duplicate principals or personal Spaces; covered in Tasks 3–4 through unique constraints and concurrency tests.
3. A caller who changes `userId`, `spaceId`, `paymentId` or recipient ID must receive denial/not-found rather than another user's data; covered in Task 6 cross-principal route tests.
4. Expired or malformed provider credentials must fail closed; covered in Task 5 auth tests.
5. Replaying a write key with a different payload must conflict instead of mutating the original operation; covered in Task 7 idempotency tests.

## Task 1: Establish Reproducible Baseline

**Files:** `package.json`, `package-lock.json` only if repair is needed; evidence note `docs/superpowers/plans/evidence/baseline.md`.

- [ ] Run `npm ci` from the root and record the first failure, if any.
- [ ] If the lockfile is stale, reconcile it from the committed workspace manifests using the repository's npm version, then rerun `npm ci` in a clean install state. Do not update dependency ranges unless required to restore the declared dependency graph.
- [ ] Run `npm run typecheck` and `npm test`; record failures by exact test/command before changing application code.
- [ ] Run `npm run check:api-runtime`; document required local environment dependencies without copying secrets.
- [ ] Commit only the lockfile/config repair and baseline evidence. Do not mix feature behavior into this commit.

**Exit:** clean dependency install works and the baseline has a reproducible test result, or a specific environment-only blocker is recorded.

## Task 2: Add Versioned API Contracts

**Files:**
- Create: `packages/api-contracts/package.json`
- Create: `packages/api-contracts/src/index.ts`
- Create: `packages/api-contracts/test/schemas.test.ts`
- Modify: root `package.json`, `package-lock.json` as required by workspace resolution.

**Interfaces:** export Zod schemas and inferred types for `ApiError`, `MeResponse`, `SpaceResponse`, `WalletBindingResponse`, `BalanceResponse`, `CreateIntentRequest`, `CreateIntentResponse`, `PreparePaymentRequest`, `PreparePaymentResponse`, `RecordSubmissionRequest`, `PaymentResponse`, `ActivityResponse`. Money fields are decimal strings; chain IDs and addresses are explicit.

- [ ] Test rejects floating-point/number amounts, malformed addresses, unsupported asset/chain values and unexpected privileged fields.
- [ ] Test response parsing fails when required payment/network fields are missing.
- [ ] Implement schemas and exports with no domain side effects.
- [ ] Run `npm test` and `npm run typecheck`; commit.

## Task 3: Add Stable External Identity Links

**Files:** `packages/identity/src/index.ts`, `packages/identity/test/service.test.ts`, new `packages/identity/test/principal-linking.test.ts`, `packages/db/postgres/schema.sql`, `packages/db/src/postgres.ts`, relevant DB tests.

**Interfaces:**
- `ExternalIdentity = { provider: "privy"; subject: string; linkedAt: string; }`
- `IdentityResolution = { user: UserRecord; created: boolean; }`
- `IdentityRepository.resolveOrCreatePrincipal(input: { externalIdentity: ExternalIdentity; email?: string }): Promise<IdentityResolution>`
- A canonical user ID is generated internally and never derived from email or provider IDs.

- [ ] Test first login creates one internal principal and external identity.
- [ ] Test the same provider subject on repeated login returns the same principal.
- [ ] Test conflicting external identity mappings are rejected instead of silently reassigning ownership.
- [ ] Test email update changes profile data but does not change principal ID.
- [ ] Add a unique constraint for `(provider, subject)` and transactional repository operation.
- [ ] Run identity and DB tests; commit.

## Task 4: Introduce Personal Space Domain

**Files:**
- Create: `packages/spaces/package.json`
- Create: `packages/spaces/src/index.ts`
- Create: `packages/spaces/test/service.test.ts`
- Modify: `packages/db/postgres/schema.sql`, `packages/db/src/postgres.ts`, root workspace lock as needed.

**Interfaces:**
- `Space = { id: string; kind: "personal" | "shared"; ownerUserId: string; name: string; createdAt: string; }`
- `SpaceMembership = { spaceId: string; userId: string; role: "owner" | "member"; status: "active" | "revoked"; }`
- `SpaceService.ensurePersonalSpace(userId: string): Promise<Space>`
- `SpaceService.requireActiveMembership(userId: string, spaceId: string): Promise<SpaceMembership>`

- [ ] Test ensurePersonalSpace creates one Space on first call and returns the same Space on concurrent/repeated calls.
- [ ] Test users cannot become a member or owner by passing a user ID in the request body.
- [ ] Test revoked membership blocks access.
- [ ] Add `spaces` and `space_memberships` tables, uniqueness constraints and repository transaction.
- [ ] Apply schema from empty Postgres in integration environment; commit.

## Task 5: Implement Server-Side Session Verification

**Files:**
- Create: `apps/api/src/auth.ts`
- Modify: `apps/api/src/server.ts`, `apps/api/src/runtime.ts`, `apps/api/src/runtime.test.ts`, `apps/api/src/server.test.ts`
- Modify/add provider tests under `packages/adapters/privy/test/`.

**Interfaces:**
- `VerifiedPrincipal = { userId: string; providerSubject: string; }`
- `verifyRequestPrincipal(request: RequestLike, verifier: PrivyTokenVerifier): Promise<VerifiedPrincipal>`
- Missing, malformed, expired or invalid bearer token returns HTTP 401 without route execution.

- [ ] Add failing tests for no Authorization header, malformed bearer, invalid token and expired token.
- [ ] Verify the exact current `@privy-io/node` token-verification API against installed package types/official docs before selecting the implementation. Do not decode JWT claims without signature verification.
- [ ] Resolve verified provider subject to internal principal and ensure personal Space.
- [ ] Keep health/readiness endpoints public; protect all user data and mutations.
- [ ] Run API and adapter tests; commit.

## Task 6: Version and Authorize HTTP Routes

**Files:** `apps/api/src/server.ts`, `apps/api/src/server.test.ts`, `apps/api/src/index.ts`, related flow tests; API contract imports.

**Interfaces:** canonical user API prefix `/v1`; public `/health`, `/healthz`, `/readyz` remain unversioned. Auth context is passed to route handlers explicitly. Canonical initial routes: `GET /v1/me`, `GET /v1/spaces`, `GET /v1/wallet`, `GET /v1/balance`, `POST /v1/intents`, `POST /v1/payments/prepare`, `POST /v1/payments/:id/submission`, `GET /v1/activity`, `GET /v1/payments/:id`.

- [ ] Test every `/v1` user route rejects anonymous access.
- [ ] Test user A cannot list/get/update user B's recipients, intents, payments, settlements, audit records or Space data by changing IDs.
- [ ] Test caller-supplied owner/user fields are ignored or rejected; ownership comes from auth context.
- [ ] Test response/error payloads match `packages/api-contracts` schemas.
- [ ] Add explicit versioned route dispatch. Only add legacy aliases where existing tests/examples prove they are needed, and ensure aliases use the same auth rules.
- [ ] Run all API flow tests; commit.

## Task 7: Make Application State Durable and Tenant-Scoped

**Files:** `packages/db/src/postgres.ts`, `packages/db/postgres/schema.sql`, repositories/tests for envelopes, intents, payments, settlement, ledger, audit and jobs; `apps/api/src/index.ts`.

- [ ] Add tests proving intent/payment/audit data survives API re-instantiation against the same Postgres database.
- [ ] Add `user_id` and `space_id` foreign keys/ownership columns where domain records require them; enforce tenant filtering in repository methods.
- [ ] Ensure creation of intent + corresponding audit entry uses transactional persistence or a durable outbox/event pattern.
- [ ] Add idempotency-key persistence with principal and route scope; same key/same payload returns the original result, same key/different payload returns conflict.
- [ ] Ensure worker jobs are durable and lease acquisition/reclaim is safe for concurrent workers.
- [ ] Run Postgres integration tests from an empty database; commit.

## Task 8: Remove Unsafe Server-Signed Consumer Execution

**Files:** `apps/api/src/index.ts`, `apps/api/src/server.ts`, `apps/api/src/runtime.ts`, `packages/settlement/src/index.ts`, relevant `apps/api` and settlement tests.

- [ ] Test the public user API cannot trigger an unrestricted server-key transfer and that old execute endpoints cannot bypass user wallet authorization.
- [ ] Remove `ARC_SETTLEMENT_PRIVATE_KEY` as a requirement for consumer API startup; it may only exist behind a separately gated, non-consumer operator capability if required elsewhere.
- [ ] Make the user API prepare an immutable payment intent/transaction plan and accept a submitted transaction hash only for the same authenticated owner and approved intent.
- [ ] Persist `prepared → submitted → confirming → confirmed/failed` states; never return settled/success just because the API accepted a request.
- [ ] Disable old routes that imply server execution unless explicitly authorized for internal worker use and protected as such.
- [ ] Run API/payment tests; commit.

## Task 9: Security Review and Identity Gate

- [ ] Run root `npm run typecheck`, `npm test`, DB schema integration tests and runtime check.
- [ ] Run cross-user negative tests for all user-scoped resources.
- [ ] Run provider recovery/linking test: fresh session after recovery maps to the same internal user and expected wallet binding.
- [ ] Record any provider-specific recovery limitations; do not infer wallet recovery from successful login.
- [ ] Fresh reviewer checks session verification, privilege derivation, identity linking and persistence transaction boundaries.

**Gate:** G0 and G1 from the master plan pass. No frontend money action should begin against unauthenticated or non-tenant-scoped API routes.
