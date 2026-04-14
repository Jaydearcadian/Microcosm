# Start Here For Agents

This repository is `microcosm`.

Read the project in this exact order before making changes.

## Required Reading Order

1. `README.md`
2. `docs/MICROCOSM_AGENT_OPERATIONS.md`
3. `docs/MICROCOSM_STATUS.md`
4. `docs/MICROCOSM_IMPLEMENTATION_MATRIX.md`
5. `docs/MICROCOSM_NEXT_STEPS.md`
6. `docs/MICROCOSM_INTEGRATIONS.md`
7. `docs/MICROCOSM_DEPLOYMENT_READINESS.md`
8. `docs/MICROCOSM_REST_API_SPEC.md`
9. `docs/MICROCOSM_POSTGRES_MIGRATION_PLAN.md`
10. `docs/MICROCOSM_CLI_SPEC.md`

## Repo Areas To Inspect After Reading Docs

- `apps/api`
- `apps/worker`
- `packages/*`
- `packages/contracts`
- `scripts`
- `examples`
- `skills`

## Tests To Inspect Before Editing

- `apps/api/src/*.test.ts`
- `apps/worker/src/*.test.ts`
- `packages/**/test/*.test.ts`
- `packages/contracts/test/*.t.sol`

## Required Operating Rules

- Treat `docs/MICROCOSM_AGENT_OPERATIONS.md` as the primary handoff guide.
- Treat `docs/MICROCOSM_STATUS.md` as the current implementation ledger.
- Treat `docs/MICROCOSM_IMPLEMENTATION_MATRIX.md` as the package and integration map.
- Treat `docs/MICROCOSM_NEXT_STEPS.md` as the ordered execution queue.
- Treat `docs/MICROCOSM_INTEGRATIONS.md` as the source of truth for external systems including Arc, Privy, XMTP, Allium, Uniblock, MoonPay, Myriad, Polymarket, Hyperliquid, and Lighter.

## Baseline Verification

Run these early:

- `npm run typecheck`
- `npm test`
- `npm run contracts:test`

## Files That Matter Most For Runtime

- `apps/api/src/runtime.ts`
- `apps/api/src/index.ts`
- `apps/api/src/main.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/main.ts`
- `packages/db/postgres/schema.sql`
- `packages/db/src/postgres.ts`
- `packages/settlement/src/index.ts`
- `packages/adapters/arc/src/index.ts`
- `packages/contracts/src/SettlementRouter.sol`
- `packages/contracts/src/ClaimEscrow.sol`
- `packages/contracts/script/DeployArcContracts.s.sol`

## What To Do Before Writing Code

Provide:

1. A concise repo status summary.
2. What is implemented vs mocked vs blocked.
3. The next implementation target.
4. The exact files you plan to touch.

## What To Do After Each Meaningful Milestone

- Update the status docs.
- If you create or change a `.md` doc, generate the paired `.docx`.
- Create a checkpoint backup if the repo tooling supports it.
- Re-run verification.

## Practical Goal

Do not start by adding more scaffolding.

Prefer:

- durable runtime behavior
- persistence
- worker reliability
- Arc integration
- deployment readiness

over:

- placeholder abstractions
- speculative refactors
- UI-first work

## Current Direction

The current repo direction is:

1. make the backend durable and deployment-ready
2. deploy Arc contracts and use them in the runtime
3. add API auth and idempotency
4. continue toward SDK and CLI implementation
