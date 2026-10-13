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
