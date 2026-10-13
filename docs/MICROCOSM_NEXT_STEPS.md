# Microcosm Next Steps

## 1. Purpose

This document is the ordered implementation queue for continuing Microcosm from its current repository state.

It is not a wish list. It is the recommended execution sequence from the code that already exists today.

The order matters. If the sequence is changed casually, the project will accumulate duplicated abstractions and unstable client surfaces.

## 2. Current Starting Point

Assume the following starting state:

- runtime and docs exist
- API server exists
- identity and recipients exist
- envelopes, intents, payments, and notifications exist as domain services
- Arc settlement path exists partially
- Postgres identity repository exists
- the async API app now persists envelopes, intents, payments, and notifications through a Postgres app repository
- settlements now have a dedicated durable model and API read surface
- ledger and audit are now durable through the async app repository
- worker jobs are now durable through the async app repository and JSON fallback
- `/payments/:id/execute-async` now queues work instead of settling inline
- a worker entrypoint now exists and can drain queued jobs on demand or on an interval
- stale processing leases can now be reclaimed
- settlement confirmation replay now exists
- the contracts package now contains a direct settlement router and claim escrow with passing Foundry tests
- runtime config now supports deployed Arc contract addresses
- the contracts package now contains a deploy script and manifest shape for Arc testnet
- the repo now includes a first-party Arc contract client

That is the baseline this plan continues from.

## 3. Phase 1: Bring Up A Real Local Runtime

### Objective

Make the backend boot cleanly on a normal PC with all readiness checks green.

### Tasks

1. install and run Postgres locally
2. point `DATABASE_URL` at the running instance
3. run `npm install` cleanly on the PC
4. run `npm run db:apply-schema`
5. run `npm run check:api-runtime`
6. run `npm run start:api`
7. verify:
   - `GET /health`
   - `GET /healthz`
   - `GET /readyz`

### Exit Criteria

- Postgres check returns healthy
- Arc RPC check returns healthy
- Privy config check returns healthy
- API boots without degraded readiness

### Why This Comes First

There is no point extending persistence, workers, or contracts while the basic runtime loop has not been exercised on a normal development machine.

## 4. Phase 2: Finish Persistence For Core Domains

### Objective

Finish the remaining durable persistence gaps after the first app-state repository milestone.

### Current State

This phase is now substantially complete.

The async API app now persists:

- envelopes
- intents
- payments
- notifications
- settlements
- ledger entries
- audit events

through a Postgres-backed app repository.

### Remaining Gap

What remains from the persistence track is:

- later query models and read-optimized views
- a real migration runner over the expanding schema
- richer worker-job lease state if concurrent workers will run
- contract integration into the runtime settlement path
- real Arc deployment outputs

### Required Schema Additions

Add migrations beyond the current schema for:

- later:
  - `ledger_accounts`
  - `envelope_versions`
  - `intent_events`

### Required Refactors

- `packages/envelopes/src/index.ts`
- `packages/intents/src/index.ts`
- `packages/payments/src/index.ts`
- `apps/worker/src/index.ts`
- `packages/db/src/postgres.ts`
- `apps/api/src/index.ts`
- later migration tooling

### Exit Criteria

- service restart does not lose envelopes, intents, payments, or notifications
- service restart does not lose settlements
- service restart does not lose ledger or audit records
- service restart does not lose worker jobs
- list and get routes are backed by durable state
- payment execution writes durable payment state
- settlement lifecycle has its own dedicated durable model

### Why This Comes Second

Without durable repositories, every later surface will be built on unstable backend semantics.

## 5. Phase 3: Add Worker Infrastructure

### Objective

Turn the now-durable worker foundation into a real runtime component.

### Worker Responsibilities

- durable settlement execution worker
- settlement confirmation worker
- scheduled envelope runner
- notification delivery worker
- reconciliation worker

### Package And App Work

- extend `apps/worker/src/index.ts`
- extend `apps/worker/src/main.ts`
- persist richer lease or ownership semantics for in-flight jobs if multiple workers run
- add backoff and dead-letter handling for repeated confirmation failures
- decide queue mechanism:
  - Postgres job table first, now that the table exists, or
  - Redis/SQS if infrastructure exists

### First Queueable Jobs

- `payment.execute_async`
- `payment.reconcile`
- `recipient.send_claim_notification`
- `notification.deliver`
- `envelope.run_schedule`

### Exit Criteria

- `/payments/:id/execute-async` enqueues durable work rather than doing it inline
- a worker process can list queued jobs and process them safely
- a worker process can run in loop mode through `npm run start:worker`
- notification retries are handled out of band
- settlement confirmation is replayable
- stale worker leases can be reclaimed safely

### Why This Comes Third

The API no longer settles async work inline, and a worker process now exists to drain queued jobs, but confirmation, replay, and multi-worker safety are still incomplete.

A real payment system needs retries, replay, dead-letter handling, and separation of request latency from settlement latency.

## 6. Phase 4: Integrate The Real Arc Contracts

### Objective

Connect the runtime to the contract-backed settlement primitives that now exist in the contracts package.

### Contracts Already Present

- `SettlementRouter`
- `ClaimEscrow`

Optional later:
- `TreasuryVault`

### Remaining Contract Work

- run the deployment script on Arc testnet and commit the resulting address manifest
- claim flow refactor to use `ClaimEscrow`
- negative-path and authorization tests
- replace any remaining fallback paths with the first-party Arc client as the default contract execution path

### Exit Criteria

- claimable payments are represented by real onchain escrow state
- direct payments produce consistent onchain events
- settlement reconciliation can use onchain contract events
- the worker uses deployed contract addresses, not placeholder app logic
- a real Arc testnet deployment manifest exists in the repo

### Why This Comes Fourth

The contracts, deployment assets, and first-party Arc client now exist. The remaining work is real Arc deployment and wiring the real manifest into runtime usage on a normal development machine.

## 7. Phase 5: Finish Identity And Claim UX Flows

### Objective

Make recipient claiming and wallet assignment product-grade.

### Tasks

- add claim token or signed claim invitation flow
- add claim notification flow
- add resend invitation support
- persist claim attempts and claim history
- extend Privy sync for wallet metadata
- support richer identity linkage:
  - email
  - Google
  - Privy user id

### Endpoints To Add

- `POST /recipients/:id/send-claim`
- `POST /claims/verify`
- `POST /claims/complete`

### Exit Criteria

- unresolved recipients can be invited and later claim safely
- claim process has real audit records
- claim process no longer relies on caller knowledge alone

## 8. Phase 6: Add Authentication, Authorization, And Tenant Scoping

### Objective

Turn the raw HTTP surface into a real multi-actor API.

### Tasks

- API auth model
- service API keys or bearer tokens
- organization scoping
- actor metadata in request context
- role model for:
  - user
  - org admin
  - org operator
  - agent

### Cross-Cutting Requirements

- idempotency keys for write APIs
- consistent error schema
- structured request validation
- request logging and correlation ids

### Exit Criteria

- payment and envelope APIs are not anonymous
- actions are attributable to a principal
- org boundaries are enforced

## 9. Phase 7: Implement Internal Ledger And Audit

### Objective

Make the system financially explainable and replayable.

### Ledger Scope

- liabilities for pending claims
- settled disbursements
- treasury debits
- fee accounting
- notification and retry metadata when financially relevant

### Audit Scope

- recipient resolution
- envelope creation and updates
- intent evaluation
- payment creation
- settlement execution
- settlement confirmation
- claim completion

### Exit Criteria

- every payment state change can be reconciled to ledger state
- every privileged action emits an audit record

## 10. Phase 8: Finish Notifications And Communications

### Objective

Turn internal events into user-visible and agent-visible communication flows.

### Channels

- email
- XMTP
- webhooks

### First Event Set

- recipient invited
- payment pending claim
- payment settled
- payment failed
- claim completed
- scheduled envelope execution failed

### Package Work

- extend `packages/notifications`
- connect `packages/adapters/xmtp`
- add concrete email provider adapter

### Exit Criteria

- notifications are durable
- deliveries are retried
- delivery failures are observable

## 11. Phase 9: Finish The TypeScript SDK

### Objective

Expose Microcosm as a stable developer-facing package.

### SDK Modules To Build

- `client.recipients`
- `client.envelopes`
- `client.intents`
- `client.payments`
- `client.notifications`
- `client.health`

### Required Features

- typed request and response shapes
- API key or bearer auth support
- idempotency helpers
- pagination helpers
- ergonomic errors

### Exit Criteria

- internal tools and future CLI can use the SDK instead of calling raw HTTP

### Why SDK Comes Before CLI

The CLI should be a thin wrapper around the SDK. Otherwise product behavior will fork.

## 12. Phase 10: Build The CLI

### Objective

Create an operator and developer CLI on top of the SDK.

### Package To Add

- `packages/cli`

### First Commands

- `mcosm health`
- `mcosm recipients resolve`
- `mcosm recipients claim`
- `mcosm envelopes create`
- `mcosm envelopes list`
- `mcosm payments create`
- `mcosm payments execute`
- `mcosm payments status`
- `mcosm notifications list`
- `mcosm db apply-schema`

### Output Rules

- human output by default
- `--json` for automation
- stable exit codes

### Exit Criteria

- developers and operators can exercise the backend without writing ad hoc scripts

## 13. Phase 11: Add Business And Agent Features

### Objective

Move beyond core payments into the actual Microcosm product model.

### Business Features

- treasury sources
- scheduled payroll
- bill pay
- recurring vendor disbursements
- approval routing

### Agent Features

- policy-scoped execution
- budgets
- time windows
- allowed recipient classes
- agent auditability

### Dependency Warning

This phase should not start until:

- repositories are durable
- workers exist
- contracts exist
- auth exists

## 14. Phase 12: Integrate Broader Data And Market Systems

### Objective

Connect the broader data-plane and market adapters without polluting the payment core.

### Integrations For This Phase

- Allium
- XMTP, if not already complete
- Uniblock
- Myriad
- Polymarket
- Hyperliquid
- Lighter
- MoonPay
- Open Wallet Standard

### Rule

These should remain adapter-driven and optional until a concrete business requirement demands tighter integration.

Do not let venue adapters drive the payment core design.

## 15. Concrete Next 10 Tasks

If work resumes immediately on a PC, do these exact tasks first:

1. clean-install dependencies on the PC
2. start Postgres
3. apply base schema
4. boot API successfully
5. add envelope repository tables and code
6. add intent repository tables and code
7. add payment and settlement repository tables and code
8. add notification repository tables and code
9. implement worker job model and first worker loop
10. create first Arc contract files and tests

## 16. What To Avoid Next

Do not do these next:

- build the frontend first
- overbuild market adapters
- implement CLI before SDK stabilization
- move rich policy evaluation onchain too early
- add production deployment complexity before persistence and workers are complete

## 17. Completion Conditions For “Actual Product On Testnet”

Microcosm should only be considered an actual testnet product when all of the following are true:

- Postgres-backed persistence exists for all core payment domains
- API boots cleanly against live Postgres
- worker system runs settlement and notification jobs
- Arc contracts are deployed on testnet
- claimable payments use real escrow state
- direct payments use contract-backed settlement routing
- notifications deliver over at least one real user-facing channel
- SDK exists and is usable
- CLI exists for operator workflows

Until then, the codebase is a serious foundation, but not the finished testnet product.
