# Baseline Verification Evidence

**Date:** 2026-10-13  
**Plan:** `docs/superpowers/plans/2026-10-13-microcosm-identity-api.md` — Task 1: Establish Reproducible Baseline

## 1. Initial `npm ci`
Initial run failed with missing packages from lockfile:
- `@solana/codecs-core@5.5.1`
- `@solana/codecs-numbers@5.5.1`
- `@solana/errors@5.5.1`
- `chokidar@5.0.0`
- `dotenv@17.4.2`
- `pg` dependencies (`pg-cloudflare`, `pg-pool`, etc.)
- `commander@14.0.2`

## 2. Lockfile Reconciliation
Lockfile was reconciled using `npm install --package-lock-only`.
Clean install re-tested:
- `npm ci`: **PASS** (added 1940 packages, audited 1967 packages in 1m)

## 3. Baseline Verification Checks

### `npm test`
- **Command:** `npm test`
- **Result:** **PASS** (69 passed, 0 failed, duration ~3.7s)
- All unit and integration test suites for `apps/api`, `apps/worker`, domain packages (`envelopes`, `identity`, `intents`, `ledger`, `notifications`, `payments`, `persistence`, `policy-engine`, `recipient-resolution`, `sdk`, `settlement`), and adapters passed.

### `npm run typecheck`
- **Command:** `npm run typecheck` (`tsc --noEmit -p tsconfig.json`)
- **Result:** **PASS** (0 errors)

### `npm run check:api-runtime`
- **Command:** `npm run check:api-runtime`
- **Result:** Fails expectedly when `.env` is absent (`node: .env: not found`) or missing required keys (`Missing required environment variable: DATABASE_URL`).
- **Required local environment variables identified:**
  - `DATABASE_URL` (PostgreSQL connection string)
  - `PRIVY_APP_ID` (Privy public project ID)
  - `PRIVY_APP_SECRET` (Privy server authentication secret)
  - `ARC_SETTLEMENT_PRIVATE_KEY` / `PRIVATE_KEY` (Arc wallet private key)
  - `ARC_MAINNET_RPC_URL` / `ARC_TESTNET_RPC_URL` (Arc RPC endpoint)

## 4. Post-Contract & Web Scaffold Verification (Plan 1 Task 2 & Plan 2 Task 1)

**Date:** 2026-10-14  
Following the implementation of versioned API contracts (`packages/api-contracts`), identity principal resolution & cryptographic signature verification (`packages/identity`), personal space domains (`packages/spaces`), and the consumer web application scaffold (`apps/web` / `@mcosm/web`):

### 1. `npm ci`
- **Status:** **PASS**
- **Evidence:** Added 1959 packages, audited 1989 packages in 2m. Monorepo workspaces (`@mcosm/web`, `@mcosm/api-contracts`, `@mcosm/identity`, `@mcosm/spaces`, etc.) linked cleanly.

### 2. `npm test`
- **Status:** **PASS** (90 passing, 0 failing)
- **Evidence:** Complete test suite runs in ~5.7s via `node --experimental-strip-types --test apps/**/*.test.ts packages/*/test/**/*.test.ts packages/adapters/*/test/**/*.test.ts`.
- **Coverage Highlights:**
  - `packages/api-contracts`: 12 test assertions validating schemas for `MeResponse`, `SpaceResponse`, `BalanceResponse`, `CreateIntentRequest`, `PreparePaymentResponse`, `RecordSubmissionRequest`, `PaymentResponse`, `ActivityResponse`, and standard error envelopes.
  - `packages/identity`: 5 new assertions validating canonical principal creation, provider subject deduplication, email update idempotency, conflicting link rejection, and EIP-191 / viem signature verification.
  - `packages/spaces`: 4 new assertions validating idempotent personal space creation, concurrency safety, active membership checks, and owner isolation.
  - `apps/web`: Smoke test verifying Next.js routes and layout structure.

### 3. `npm run typecheck`
- **Status:** **PASS** (0 errors)
- **Evidence:** `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` completes cleanly across root, backend apps, domain packages, and Next.js web application.

### 4. `npm run build --workspace=@mcosm/web`
- **Status:** **PASS**
- **Evidence:** Next.js production build succeeded with Turbopack/Webpack. Static pages generated:
  - `/` (245 kB First Load JS)
  - `/_not-found` (106 kB First Load JS)

### 5. Untested / External Verification Status (Distinction from passing local checks)
- **Live PostgreSQL database migrations & connections (`checkPostgres`):** **NOT RUN** (tested via in-memory repository mocks and query unit tests; live database connection requires runtime instance in Plan 1 Task 7).
- **Live Arc mainnet / testnet JSON-RPC transactions (`checkArcRpc`):** **NOT RUN** (RPC calls and transaction receipts tested via mock fetch and synthetic JSON-RPC responses; live chain submission gated for Plan 3).
- **Live Privy authentication tokens:** **NOT RUN** (Privy auth provider uses valid 25-char dev placeholder `clmockprivyapp00000000000` to allow static prerendering; live Privy token validation requires live credentials).

## 5. Server-Side Session Verification & Space Authorization (Plan 1 Task 5)

**Date:** 2026-10-14  
Following the implementation of server-side Privy session verification, canonical principal resolution, and Space authorization middleware (`apps/api/src/auth.ts`, `apps/api/src/server.ts`, `packages/adapters/privy/src/index.ts`):

### 1. `npm test`
- **Status:** **PASS** (**102 passing, 0 failing**, duration ~6.8s)
- **Coverage Highlights:**
  - `packages/adapters/privy`: Added 3 tests validating `createPrivyTokenVerifier` against ES256 SPKI keys, rejecting expired tokens, and rejecting mismatched audience or invalid signatures.
  - `apps/api/src/auth.ts`: Added 8 tests in `auth.test.ts` verifying `extractBearerToken`, case-insensitive `getHeader`, `verifyRequestPrincipal`, `authenticateAndAuthorize` (full session + canonical principal resolution + personal space), rejection of expired tokens (`token_expired`), rejection of client-supplied spoofed principal IDs (`identity_mismatch`), non-leaking 404 on cross-space access attempts, and space owner role enforcement.
  - `apps/api/src/server.ts`: Added HTTP integration tests in `server.test.ts` testing public health endpoints, 401 on missing/malformed/expired/invalid Authorization headers, 200 on `/v1/me` with stable principal and personal space, idempotency on repeated calls, 403 on client-supplied identity spoofing in headers or mutation bodies, and non-leaking 404 on unauthorized cross-space requests.

### 2. `npm run typecheck`
- **Status:** **PASS** (0 errors across root, backend apps, domain packages, and Next.js web application).

### 3. `npm run build --workspace=@mcosm/web`
- **Status:** **PASS** (Next.js production build succeeded; static routes `/` and `/_not-found` generated cleanly).

## 6. Versioned Route Dispatcher & Tenant Isolation Authorization (Plan 1 Task 6)

**Date:** 2026-10-14  
Following the implementation of the centralized `/v1` route dispatcher and principal/space tenant isolation layer (`apps/api/src/dispatcher.ts`, `apps/api/src/server.ts`, `apps/api/src/auth.ts`):

### 1. `npm test`
- **Status:** **LOCAL_PASS** (**103 passing, 0 failing**, duration ~7.3s)
- **Coverage Highlights:**
  - `apps/api/src/dispatcher.test.ts`: Added comprehensive adversarial and isolation test suite validating all 5 release gates:
    - **Gate 1 (Route coverage & method validation):** Verified `/v1` endpoints (`/v1/me`, `/v1/spaces`, `/v1/spaces/:id`, `/v1/balance`, `/v1/wallet`, `/v1/recipients`, `/v1/recipients/resolve`, `/v1/recipients/:id`, `/v1/recipients/:id/claim`, `/v1/envelopes`, `/v1/envelopes/:id`, `/v1/intents`, `/v1/intents/:id`, `/v1/payments`, `/v1/payments/prepare`, `/v1/payments/submission`, `/v1/payments/:id`, `/v1/payments/:id/submission`, `/v1/payments/:id/execute`, `/v1/payments/:id/execute-async`, `/v1/payments/:id/claim`, `/v1/activity`). Verified 405 Method Not Allowed with standard `Allow` header on unsupported methods (e.g. `DELETE /v1/me`, `POST /v1/balance`), 404 `route_not_found` on unknown routes, 413 `payload_too_large` on bodies exceeding 100KB, and 400 `invalid_json` on malformed bodies.
    - **Gate 2 (Caller-controlled ownership rejection):** Tested rejection of top-level spoofed `userId` or `ownerUserId` (403 `identity_mismatch`), nested spoofed ownership inside body metadata (403 `identity_mismatch`), conflicting `x-principal-id` header (403 `identity_mismatch`), and unauthorized `spaceId` in request bodies (404 `space_not_found`).
    - **Gate 3 (Tenant isolation & non-leaking boundary):** Verified Principal A cannot read, mutate, or discover Principal B's space (404 `space_not_found`), envelopes (404 `envelope_not_found`), recipients (404 `recipient_not_found`), intents (404 `intent_not_found`), or payments (404 `payment_not_found`). Non-leaking 404 policy verified across all resources.
    - **Gate 4 (Cross-tenant reference & role authorization):** Verified cross-tenant nested references are rejected (e.g. intent in Space A referencing recipient or envelope in Space B -> 404 `recipient_not_found` / `envelope_not_found`). Verified non-owner member attempting owner-only actions (`DELETE /v1/spaces/:id`) returns 403 `forbidden`. Verified viewer attempting payment execution returns 403 `forbidden`. Verified revoked/suspended membership returns 403 `forbidden`.
    - **Gate 5 (Payment stage separation):** Verified payment preparation (`POST /v1/payments/prepare`) returns calldata with `value: "0"` for client signing without executing transactions. Verified submission and execution stages remain decoupled.

### 2. `npm run typecheck`
- **Status:** **LOCAL_PASS** (0 errors across root, apps, packages, and web workspace).

### 3. `npm run build --workspace=@mcosm/web`
- **Status:** **LOCAL_PASS** (Next.js production build succeeded with Turbopack/Webpack; static routes `/` and `/_not-found` generated cleanly).

### 4. Verification Distinctions (Deterministic Local Mocks vs. Live Services)
- **Deterministic Cryptographic Verification (Local):** **LOCAL_PASS** — Verified with RFC 7515/7519 compliant ES256 key pairs via `jose` and `@privy-io/node` verifier.
- **Live Privy Cloud Credential Verification:** **NOT RUN** — Live JWT exchange against Privy's remote JWKS endpoint (`auth.privy.io`) is gated behind live production credentials.
- **Live PostgreSQL Database Connection:** **NOT RUN** — In-memory identity, spaces, and application state services utilized for API unit tests; live PostgreSQL persistence will be verified under Plan 1 Task 7.
- **Live Arc Mainnet / Testnet RPC Transactions:** **NOT RUN** — Synthetic JSON-RPC mocks used locally; live chain submission gated for Plan 3.


