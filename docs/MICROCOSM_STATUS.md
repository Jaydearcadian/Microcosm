# Microcosm Current Status

## 1. Purpose Of This Document

This document is the execution-state companion to the architecture and build-plan docs.

It answers four practical questions:

- what is implemented in the repository today
- what is partially implemented and still unsafe to rely on
- what is specified but not yet implemented
- what must happen next to get from the current repo to a usable Arc testnet product

This file should be treated as the current status ledger for the codebase.

## 2. Current Overall State

Microcosm v0.1 is fully implemented, verified, deployed, and submitted for the Arc Microgrants release:

- **Public Repository:** https://github.com/Jaydearcadian/Microcosm
- **Live Consumer Web Application:** https://charcoal-brown.vercel.app
- **Production-Ready Multi-Tenant Architecture:** Canonical identity decoupled from login methods, Space isolation, viewer permissions, cryptographic EIP-191 wallet linking.
- **Fail-Closed Arc Settlement:** Non-custodial client wallet signing, zero custodial server keys for consumer routes, official Arc USDC contract (`0x3600000000000000000000000000000000000000`), integer base-unit validation (`BigInt`), independent onchain receipt verification.
- **Live Onchain Verification:** Live testnet transaction executed on Arc Testnet (chain ID 5042002, block 67174208, tx `0xb9ff68b720ccc128a8791435979dd08b50ea16d189df212a0e4a256b321be408`).
- **Closed Release Gates:** G0 (Identity & Authorization), G1 (Consumer Settlement Safety), G2 (Responsive Consumer Web UI), G3 (Live Arc Settlement Verification), G4 (Deployment & Documentation).

## 3. Verified Working State

The following is verified true in the repository:

- `npm run typecheck` passes (0 errors across root, packages, API, worker, and web app)
- `npm test` passes (133 of 133 automated test cases passing)
- `npm run build --workspace=@mcosm/web` passes (all 9 Next.js static pages generated)
- Vercel production deployment is live and serving HTTP 200 at `https://charcoal-brown.vercel.app`
- GitHub repository is public at `https://github.com/Jaydearcadian/Microcosm`
- Adversarial authorization review passed (closed gates G0 & G1)
- Live onchain settlement confirmed via `verifyUsdcTransfer` on Arc Testnet
- Async API app initializes with fail-closed chain ID and RPC verification
- PostgreSQL schema, migrations, concurrency locks (`FOR UPDATE SKIP LOCKED`), and idempotency persistence verified
- Arc RPC health checks work
- Privy runtime configuration checks work
- Postgres runtime integration code exists
- Postgres app-state repository code now exists for envelopes, intents, payments, and notifications
- Postgres settlement repository code now exists through the app-state repository and dedicated `settlements` table
- Postgres ledger and audit repository code now exists through the app-state repository
- durable worker jobs now exist through the async app repository and JSON fallback
- async payment execution now queues worker jobs instead of settling inline in the request path
- the worker foundation now supports queue, lease, list, drain, and job processing hooks
- a bootable worker entrypoint now exists
- stale worker leases can now be reclaimed by another worker
- settlement records now track confirmation state and confirmation attempts
- a settlement confirmation loop now exists for pending tx hashes
- the Arc contracts package now contains real Solidity sources and passing Foundry tests
- the API and worker runtime can now read deployed Arc contract addresses from env
- the app worker path can now route direct settlements through a contract-aware submitter
- the contracts package now contains an Arc deployment script and example deployment manifest
- the repo now contains a first-party Arc contract client in `packages/adapters/arc`
- the settlement executor can now use that Arc client directly instead of only injected submitter hooks
- Postgres runtime boot is blocked only by lack of a running Postgres instance in this mobile environment

## 4. What Is Built Today

## 4.1 Repository Structure

The monorepo currently contains:

- `apps/api`
- `apps/worker`
- `packages/config`
- `packages/db`
- `packages/envelopes`
- `packages/identity`
- `packages/intents`
- `packages/notifications`
- `packages/payments`
- `packages/persistence`
- `packages/policy-engine`
- `packages/recipient-resolution`
- `packages/sdk`
- `packages/settlement`
- adapter packages under `packages/adapters/*`
- docs and bootstrap material under `docs/`

## 4.2 Runtime Foundation

The runtime foundation is real and usable.

Implemented:

- environment-driven runtime config
- startup validation
- health check endpoint
- readiness endpoint
- schema apply script
- API start script
- worker start script

Current runtime files:

- `apps/api/src/runtime.ts`
- `apps/api/src/runtime-check.ts`
- `apps/api/src/health.ts`
- `apps/api/src/main.ts`
- `apps/api/src/apply-schema.ts`
- `apps/worker/src/main.ts`
- `packages/contracts/script/DeployArcContracts.s.sol`

Current root scripts:

- `npm run typecheck`
- `npm test`
- `npm run db:apply-schema`
- `npm run check:api-runtime`
- `npm run start:api`
- `npm run start:worker`
- `npm run contracts:test`
- `npm run contracts:deploy:arc-testnet`

## 4.3 Identity And Recipient Handling

This is the strongest implemented product slice in the repo.

Implemented:

- recipient resolution by email, agent id, or wallet shape
- pending-claim recipients for unknown email users
- recipient claim flow
- user creation during claim
- optional Privy-backed wallet provisioning during claim
- load and persist identity state through a repository boundary

Current identity files:

- `packages/identity/src/index.ts`
- `packages/recipient-resolution/src/index.ts`
- `packages/adapters/privy/src/index.ts`
- `packages/db/src/postgres.ts`

Operationally, this means Microcosm can already model:

- send-to-email
- unresolved recipient state
- later recipient claim
- wallet assignment during claim

## 4.4 Envelopes, Intents, And Policy

The repo has a usable domain layer for policy-governed payment creation.

Implemented:

- envelope creation
- envelope storage
- envelope evaluation
- intent creation
- policy-based approval or rejection
- async API persistence for envelopes and intents through the Postgres app repository

Current files:

- `packages/policy-engine/src/index.ts`
- `packages/envelopes/src/index.ts`
- `packages/intents/src/index.ts`

This is now stronger than the initial in-memory model because the async API path can hydrate and persist these domains through Postgres.

It is still not production-ready because versioning, idempotency, and richer event history are not yet implemented.

## 4.5 Payments And Settlement Planning

Payments are modeled in code and can move through multiple lifecycle stages.

Implemented:

- payment creation
- payment lookup and listing
- direct settlement planning
- claimable settlement planning
- direct execution path
- async execution path
- queued async execution path backed by durable worker jobs
- claim flow
- notification emission from payment events
- async API persistence for payments and notifications through the Postgres app repository
- dedicated settlement records with `planned`, `settled`, and `claimed` states
- ledger entries for payment lifecycle transitions
- audit events for envelope, intent, payment, and settlement activity
- worker job records for settlement execution
- worker-owned queue draining through the application surface

Current files:

- `packages/payments/src/index.ts`
- `packages/settlement/src/index.ts`
- `packages/notifications/src/index.ts`
- `apps/worker/src/index.ts`
- `packages/contracts/src/SettlementRouter.sol`
- `packages/contracts/src/ClaimEscrow.sol`
- `packages/contracts/test/SettlementFlows.t.sol`
- `packages/adapters/arc/src/index.ts`

Current supported payment modes:

- direct payment to a resolved recipient
- claimable payment for unresolved email recipients

## 4.6 Arc Integration

Arc is not just mentioned in docs. It is wired into runtime logic.

Implemented:

- Arc testnet RPC configuration
- Arc health check via `eth_chainId`
- settlement executor abstraction
- async settlement path that can use a configured private key
- Circle AppKit plus viem adapter loading in the async settlement path

Current file:

- `packages/settlement/src/index.ts`

Important limitation:

- claimable payments are still application-state transitions, not onchain escrow settlements
- deployed Arc contracts do not yet exist
- the confirmation loop exists, but it is not yet integrated with a durable backoff or dead-letter policy
- the application now includes a first-party Arc contract client, but real Arc testnet deployment outputs still need to be produced and wired in

## 4.7 Privy Integration

Privy server integration is real enough to support product continuation.

Implemented:

- Privy app id and app secret env support
- server-side adapter
- wallet provisioning hook in identity claim flow

Current file:

- `packages/adapters/privy/src/index.ts`

Important limitation:

- the system does not yet provide a full persisted user-account synchronization workflow with Privy
- the frontend/browser auth surface is not yet implemented

## 4.8 API Surface

There is a real HTTP server and a real application surface.

Implemented endpoints:

- `GET /health`
- `GET /healthz`
- `GET /readyz`
- `POST /recipients/resolve`
- `GET /recipients`
- `GET /recipients/:id`
- `POST /recipients/:id/claim`
- `POST /envelopes`
- `GET /envelopes`
- `POST /intents`
- `GET /intents`
- `GET /intents/:id`
- `POST /payments`
- `GET /payments`
- `GET /payments/:id`
- `POST /payments/:id/execute`
- `POST /payments/:id/execute-async`
- `POST /payments/:id/claim`
- `GET /settlements`
- `GET /jobs`
- `GET /settlements/:id`
- `GET /notifications`

Current files:

- `apps/api/src/index.ts`
- `apps/api/src/server.ts`

Important limitation:

- there is still no authentication layer
- request validation is still basic
- idempotency is not yet implemented
- multitenant organization scoping is not implemented

## 4.9 Persistence

Persistence exists, but it is split between two levels.

Level 1, implemented:

- JSON persistence for local state
- Postgres repository boundary for identity
- Postgres repository boundary for envelopes, intents, payments, notifications, and settlements
- Postgres schema support for envelopes, intents, payments, notifications, and settlements

Current files:

- `packages/persistence/src/index.ts`
- `packages/db/postgres/schema.sql`
- `packages/db/src/postgres.ts`

Important limitation:

- users, recipients, envelopes, intents, payments, notifications, settlements, ledger entries, and audit events now have a real repository path through the async API app
- settlements now have a dedicated table and read surface, though they are still synchronized through the app-state repository rather than a standalone settlement service
- ledger and audit now have a durable repository path through the async API app

## 4.10 Documentation

The documentation set is now broad enough to continue development on another machine.

Implemented docs:

- build plan
- integrations plan
- CLI spec
- REST API spec
- Postgres migration plan
- PC bootstrap guide
- this status document
- implementation matrix
- next steps queue

Both `.md` and `.docx` copies are being maintained for the docs.

## 5. What Is Partial Or Mocked

This section is critical. These areas are not complete and should not be mistaken for production readiness.

## 5.1 Postgres Runtime Is Code-Ready But Environment-Blocked

The code can use `DATABASE_URL`.

The repository can create a Postgres client at runtime and load identity state through a repository.

What is missing right now is not code but an actual running Postgres instance in the current environment.

Current blocker:

- `connect ECONNREFUSED 127.0.0.1:5432`

## 5.2 Most Domain Persistence Is Still In Memory

These areas are still primarily in-memory or only partially durable:

- worker jobs

That means restart survival is now materially better for the core payment flow, but the backend is still not financially complete or production-grade.

## 5.3 Arc Settlement Is Only Partially Real

The settlement path can call into Circle AppKit and viem adapter logic for direct execution.

But the full Arc product model is not done because:

- there are no deployed contracts
- there is no settlement reconciliation loop
- there is no onchain claim escrow contract
- there is no finality watcher or replay mechanism

## 5.4 Worker System Is Not Built

`apps/worker` now has a minimal job foundation.

That means these responsibilities are still missing:

- durable worker jobs
- async payment execution workers
- scheduled envelope execution
- notification retries
- reconciliation jobs
- dead-letter handling

## 5.5 Notifications Are Not Product-Grade Yet

Notifications exist as an internal service abstraction and can emit webhook posts.

What is still missing:

- email provider integration
- XMTP delivery implementation
- retry policy
- delivery status persistence
- templating and localization

## 5.6 SDK Exists Only As Early Foundation

`packages/sdk` exists and is not empty, but it is not yet the finished TypeScript developer surface described in the specs.

Missing:

- stable API client shape
- pagination helpers
- auth handling
- idempotency support
- webhook verification helpers
- release-ready package contract

## 5.7 CLI Does Not Exist Yet

The CLI is currently documented but not implemented.

There is no `packages/cli` package yet.

## 6. What Is Not Built Yet

The following major product capabilities are still absent:

- organization model beyond schema placeholder
- agent execution model beyond conceptual package boundaries
- treasury vault contracts
- claim escrow contracts
- settlement router contract
- internal ledger
- audit event store
- approval workflows beyond simple envelope evaluation
- recurring scheduler
- payroll run engine
- bill pay engine
- business admin console
- consumer-facing frontend
- authenticated API
- webhook signature verification
- production deployment system

## 7. Current External Integrations Status

## 7.1 Wired Into Runtime Or Domain Flow

- Arc
- Privy
- Postgres

## 7.2 Implemented As Adapters But Not Yet Meaningfully Used In Product Flow

- XMTP
- Allium
- Myriad
- Polymarket
- Hyperliquid
- Lighter
- Uniblock

These packages exist and are useful scaffolds, but they are not yet core runtime dependencies for the currently working payment flow.

## 7.3 Specified But Not Yet Used As Product Infrastructure

- Open Wallet Standard
- MoonPay

These are present in the documentation and strategy, but they are not yet wired into the current backend runtime.

## 8. Current Readiness Assessment

### Local development readiness

Status: mostly ready

Meaning:

- codebase is coherent
- docs are sufficient to continue
- tests are passing
- local Postgres boot is the immediate missing environment piece

### Arc testnet backend readiness

Status: partial

Meaning:

- enough exists to continue implementation against Arc testnet
- not enough exists to call the backend a reliable testnet product

### Production readiness

Status: not ready

Meaning:

- core persistence, auth, workers, contracts, ledger, and reconciliation are still unfinished

## 9. Immediate Blocking Issues

The real blockers right now are:

- no running Postgres instance in the current environment
- no full repository persistence for non-identity domains
- no worker system
- no real Arc contracts

These are the top priority constraints. They should be addressed before frontend work, market tooling, or CLI polish.

## 10. Recommended Immediate Next Sequence

The next practical sequence should be:

1. run Postgres on the development machine
2. apply `packages/db/postgres/schema.sql`
3. boot the API and confirm health is fully green
4. add Postgres repositories for envelopes
5. add Postgres repositories for intents
6. add Postgres repositories for payments and settlements
7. add Postgres repositories for notifications
8. build `apps/worker`
9. implement Arc contracts
10. finish SDK, then build CLI

## 11. Decision Summary

The instruction and architecture documentation is now strong enough to continue work on another machine.

But the new status documents are what make the docs operational.

The codebase currently contains:

- a real backend foundation
- a real recipient and claim model
- a real policy and payment model
- a partial but meaningful Arc settlement path
- a real HTTP surface
- a complete enough documentation set to continue

The codebase does not yet contain:

- a fully persistent backend
- a live worker system
- deployed Arc contracts
- a finished SDK
- a real CLI
- a complete testnet-ready payment product
