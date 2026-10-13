# Microcosm v0.1 Consumer App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Follow RED/GREEN/REFACTOR for behavior changes. Every task ends with a verified result and commit.

**Goal:** Deliver Microcosm as a real, responsive consumer financial app with a persistent recoverable identity, a personal Space, and user-authorized USDC send/receive on Arc mainnet.

**Architecture:** Preserve the TypeScript monorepo and domain packages. Add a responsive Next.js app, versioned API contracts, stable internal identity and Space persistence, authenticated resource access, and a wallet-authorized Arc transfer path. PostgreSQL stores application state; Arc receipts and ERC-20 transfer evidence determine whether a payment settled. The first release does not deploy the existing escrow/router contracts.

**Tech Stack:** TypeScript, existing Node HTTP API and domain packages, PostgreSQL, Privy React/server SDKs, viem, Next.js/React, Arc mainnet, USDC; existing Foundry contract toolchain retained for separate contract review.

**Specs:** `docs/MICROCOSM_PRD.md`; `docs/MICROCOSM_TECHNICAL_SPEC.md`. Existing implementation context: `docs/MICROCOSM_STATUS.md`, `docs/MICROCOSM_IMPLEMENTATION_MATRIX.md`, `docs/MICROCOSM_DEPLOYMENT_READINESS.md`.

## Global Constraints

- The product remains Microcosm, not Certain Pay or a generic wallet wrapper.
- Mobile is the primary UX; desktop is an extensible responsive layout using the same routes, contracts and domain model.
- A Microcosm principal is not a Privy user ID, email address, or wallet address.
- Every newly authenticated principal receives one personal Space idempotently.
- All user-scoped API requests derive the principal from a verified server-side session; client-supplied owner IDs never prove authority.
- User transfers are signed through the user's wallet/provider; the API's server-held private key must not sign consumer transfers.
- Mainnet/testnet selection is explicit; production fails closed if configured chain ID/RPC disagree.
- ERC-20 USDC amounts use integer base units and a verified 6-decimal interface. Do not mix these with the native 18-decimal USDC gas representation.
- The browser never receives API secrets, server keys, database credentials, or provider app secrets.
- Do not deploy current `ClaimEscrow` or `SettlementRouter` unchanged. No public email claim flow in v0.1.
- No mocks, fixtures, recorded transactions, or simulated settlement may satisfy live acceptance gates.
- Exclude market adapters, agent autonomy, cross-chain flows and shared-Space spending from the v0.1 critical path.

## Review Focus

1. **Identity continuity:** changing/recovering authentication must not silently create a second Microcosm principal or change wallet control.
2. **Cross-principal access:** guessed IDs and altered Space/payment IDs must not reveal or mutate another user's resources.
3. **Wrong-chain and decimal errors:** the app must refuse unsupported networks/assets and never mis-scale an amount.
4. **Transaction uncertainty:** pending, dropped, reverted, not-yet-indexed and RPC-failure states must not be shown as success.
5. **Replay/double-submit:** retries, refreshes, duplicate callbacks and repeated clicks must not initiate a second payment or duplicate a state transition.

## Plan Decomposition

This specification is divided into three independently reviewable implementation plans because identity/API security, the consumer interface, and financial settlement have distinct tests and failure costs.

1. [`2026-10-13-microcosm-identity-api.md`](./2026-10-13-microcosm-identity-api.md) — reproducible runtime, versioned contracts, stable identity, personal Space, server authentication and authorization, durable state.
2. [`2026-10-13-microcosm-responsive-web.md`](./2026-10-13-microcosm-responsive-web.md) — responsive application shell, identity/recovery UX, home, People, Money, Activity and Settings.
3. [`2026-10-13-microcosm-arc-payment-release.md`](./2026-10-13-microcosm-arc-payment-release.md) — fail-closed network configuration, user-authorized USDC transfers, receipt verification, operations, deployment and submission evidence.

## Dependency Order

```text
0. Baseline and lockfile repair
   ↓
1. API contracts + stable principal + personal Space
   ↓
2. Server session verification + ownership authorization + durable state
   ↓
3. Arc config/read-only wallet data + frontend shell/auth
   ↓
4. Prepare intent → explicit user signature → hash persistence
   ↓
5. Chain receipt/log verification → Activity/receipt UI
   ↓
6. Recovery, adversarial integration tests, deploy, independent live verification
```

Do not build screens against undocumented response shapes. Do not begin the live money flow before the auth and authorization plan passes its gate. Parallelize only tasks whose interfaces have already been fixed and whose files do not overlap.

## Global Verification Commands

Run from repository root, recording exact outputs and exit codes:

```bash
npm ci
npm run typecheck
npm test
npm run check:api-runtime
npm run db:apply-schema
npm run contracts:test
```

The last command is conditional on Foundry being installed. Run Postgres- and provider-gated integration checks with explicit local credentials, never with production keys. Before release, run the clean installation and all required tests again from the committed lockfile.

## Release Gates

- **G0 Baseline:** dependency install reproducible; pre-existing failures named and classified.
- **G1 Identity:** verified provider session maps to one stable Microcosm principal and one personal Space; recovery preserves identity; unauthorized access is denied.
- **G2 Consumer UX:** primary mobile and desktop flows work without fabricated state; accessible loading, empty, error and pending states exist.
- **G3 Arc payment:** exact user-approved transfer is submitted on Arc mainnet; transaction receipt and expected USDC `Transfer` log are independently verified; duplicate submission is prevented.
- **G4 Deployment:** public HTTPS frontend/API, safe environment config, durable database, health/readiness checks, public repository, and reproducible instructions.
- **G5 Submission evidence:** at least one independently verifiable Arc mainnet transaction tied to the displayed recipient and amount. Local tests alone do not pass this gate.

## Execution Handoff

Implementation starts only after this plan and its three child plans are reviewed. Recommended method: **subagent-driven development** for bounded implementation tasks, with a fresh spec-compliance review and code-quality review after each task, then a whole-branch review. Identity, wallet authorization and settlement have costly cross-boundary failure modes and deserve independent review. Where parallel subagents are unavailable, use the same task gates sequentially in one session.
