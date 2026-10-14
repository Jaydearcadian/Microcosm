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

