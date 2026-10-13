# Microcosm Detailed Build Plan

## 1. Purpose

Microcosm, short form `mcosm`, is intended to be an Arc-native programmable payment layer for the open internet.

The product is not just a wallet wrapper and not just an automation layer. The actual goal is to provide a policy-governed payment network where:

- users can send funds to recipients using email, Google-linked identity, or agent identity
- recipients can be notified and claim funds without already holding a wallet address
- businesses can configure envelopes that define spending rules, schedules, disbursement windows, and approval controls
- agents can automate payouts, bill pay, recurring transfers, payroll, and treasury actions without receiving unrestricted spending power
- settlement occurs on Arc, using USDC-centered economics and fast finality

The system should eventually support three classes of principals:

- consumer users
- organizations
- agents

And three classes of value movement:

- direct user-to-user payments
- organization-controlled disbursements
- agent-triggered, policy-constrained settlement

## 2. Product Principles

The system should be built around the following engineering rules:

- API is the canonical backend contract
- all clients, SDKs, CLIs, and agent tools must sit on top of the same domain model
- identities and recipients must be persistent, not ephemeral request-time constructs
- agents must never hold unrestricted payment power
- every payment action must be representable as an intent that passes through policy before settlement
- every settlement action must be observable, replayable, and auditable
- Arc is the primary settlement rail
- Privy is the identity and wallet-provisioning layer
- Postgres is the initial source of truth for persistent product state

## 3. Current Implementation Status

The repository already contains working foundations for the following:

### 3.1 Runtime and Configuration

- environment-driven runtime configuration
- Arc runtime configuration
- Privy credential handling
- async API initialization
- runtime validation
- health and readiness checks

Current files of interest:

- `apps/api/src/runtime.ts`
- `apps/api/src/runtime-check.ts`
- `apps/api/src/main.ts`
- `apps/api/src/health.ts`

### 3.2 Identity and Recipients

- persistent recipient model
- pending-claim recipients for unknown email addresses
- claim flow that upgrades a pending recipient into a claimed user
- Privy-backed wallet provisioning hook during claim
- Postgres repository boundary for users and recipients

Current files of interest:

- `packages/identity/src/index.ts`
- `packages/db/src/postgres.ts`
- `packages/adapters/privy/src/index.ts`

### 3.3 Payment and Settlement

- envelope evaluation
- intent creation and approval/rejection
- payment creation
- direct Arc settlement planning
- claimable settlement planning for unresolved recipients
- async Arc settlement execution path

Current files of interest:

- `packages/policy-engine/src/index.ts`
- `packages/intents/src/index.ts`
- `packages/payments/src/index.ts`
- `packages/settlement/src/index.ts`

### 3.4 API Surface

- recipient resolution endpoint
- recipient claim endpoint
- envelope endpoints
- intent endpoints
- payment endpoints
- notifications endpoint
- health and readiness endpoints

Current files of interest:

- `apps/api/src/index.ts`
- `apps/api/src/server.ts`

## 4. What Is Still Missing

The repository is not yet an actual testnet product until the following are completed:

- a live Postgres runtime with applied schema
- database-backed repositories for all non-identity domains
- Arc contracts for escrow and settlement
- async workers for side effects
- real notification providers
- internal ledger and reconciliation
- SDK package that wraps the HTTP API
- CLI package for developer and operator use
- deployable runtime configuration for a non-mobile environment

## 5. Recommended Build Sequence

Build in this order:

1. local runtime
2. persistent domain repositories
3. Arc contracts
4. workers
5. notifications
6. SDK
7. CLI
8. deployment and observability

Do not reverse this order.

### Why This Order Matters

If SDK or CLI work is built before the backend contracts stabilize, you create two problems:

- duplicated logic and inconsistent behavior
- surface churn that forces client rewrites

If contracts are built before the offchain domain model is stable, you create another problem:

- onchain logic starts compensating for application uncertainty

The backend and persistence model must settle first.

## 6. Detailed Workstream Plan

## 6.1 Workstream A: Local Runtime and Bootstrap

### Goal

Make the system boot cleanly on a normal developer machine.

### Required deliverables

- local Postgres instance
- working `DATABASE_URL`
- applied schema
- successful runtime health check
- API server that boots without degraded health

### Existing commands

```bash
npm run typecheck
npm test
npm run check:api-runtime
npm run db:apply-schema
npm run start:api
```

### Required next additions

- `npm run dev:api`
- `npm run db:reset`
- `npm run db:seed`
- `npm run check:contracts`

### Exit criteria

- `check:api-runtime` returns all checks healthy
- `db:apply-schema` succeeds
- `start:api` starts and stays up
- `GET /healthz` returns 200
- `GET /readyz` returns 200

## 6.2 Workstream B: Persistent Repositories

### Goal

Replace in-memory stores with Postgres-backed repositories.

### Current state

Identity has a repository boundary. Envelopes, intents, payments, settlements, notifications, and ledger do not.

### Repositories to add

- `EnvelopeRepository`
- `IntentRepository`
- `PaymentRepository`
- `SettlementRepository`
- `NotificationRepository`
- `LedgerRepository`
- `AuditEventRepository`

### Rules

- repositories should load domain records, not ad hoc transport objects
- all write paths must be idempotent where possible
- repository behavior must be tested independently from HTTP
- domain services should not depend directly on SQL strings

### Required database tables beyond current schema

- `envelopes`
- `intent_events`
- `payments`
- `settlements`
- `notifications`
- `ledger_accounts`
- `ledger_entries`
- `audit_events`

### Exit criteria

- no business-critical state remains only in memory
- API server restarts without state loss
- claim flow, payment flow, and envelope flow survive restarts

## 6.3 Workstream C: Arc Contracts

### Goal

Replace simulated or offchain-only claim and routing behavior with actual onchain settlement primitives.

### Contracts to build

#### SettlementRouter

Responsibilities:

- standard direct Arc USDC settlement
- canonical payment events
- source and destination normalization

#### ClaimEscrow

Responsibilities:

- hold funds for unresolved recipients
- associate funds with claim records
- release funds upon valid claim completion

#### TreasuryVault

Responsibilities:

- organization-held payment funds
- controlled disbursement source for envelopes and scheduled payments

### What should remain offchain

- email and Google identity mapping
- recipient resolution
- policy evaluation
- approval workflows
- scheduling
- notification delivery
- ledger bookkeeping

### Testing required

- unit tests
- Foundry integration tests
- Arc testnet deployment smoke tests

### Exit criteria

- direct payments settle through deployed contracts
- claimable email payments settle through escrow
- contract addresses are tracked in runtime config

## 6.4 Workstream D: Workers

### Goal

Move side effects and retries out of synchronous API handlers.

### Workers to build

#### Settlement Worker

- picks up authorized payments
- submits Arc transactions
- tracks submission and finality
- updates settlement records

#### Notification Worker

- sends email, XMTP, and webhook notifications
- retries transient failures
- records delivery status

#### Scheduler Worker

- evaluates recurring envelopes
- emits due intents
- triggers policy evaluation

#### Reconciliation Worker

- compares internal settlement state to chain state
- repairs stale or partial records
- emits audit events

### Exit criteria

- API handlers stop doing long-running side effects
- retries are centralized
- settlement and notification flows are replayable

## 6.5 Workstream E: Notifications and Communications

### Goal

Turn payment state transitions into user-visible communication.

### Channels

- email
- XMTP
- webhooks

### Event types

- recipient invited
- claim available
- claim completed
- payment created
- payment settled
- payment failed
- envelope evaluation failed
- recurring run completed

### Components to build

- email adapter
- XMTP adapter
- webhook signer and retry handler
- notification templates
- delivery logs

### Exit criteria

- each payment state transition emits a persistent notification record
- delivery status is observable
- failures are retryable

## 6.6 Workstream F: Ledger and Audit

### Goal

Add a canonical internal financial record separate from chain state.

### Why it matters

Onchain transfers alone are not enough to model:

- pending claims
- held liabilities
- internal treasury balances
- failed disbursement retries
- business reporting
- reconciliation

### Ledger model

#### Accounts

- user receivable
- org treasury
- claim escrow liability
- settlement in flight
- fees

#### Entries

- debit
- credit
- reference type
- reference id
- timestamp

### Audit model

Every meaningful action should emit an audit event:

- recipient resolved
- recipient claimed
- envelope created
- envelope updated
- intent created
- intent approved
- payment created
- payment submitted
- payment settled
- notification sent

### Exit criteria

- all payment state transitions map to ledger state
- all critical mutations emit audit events

## 6.7 Workstream G: SDK

### Goal

Expose a clean TypeScript surface for external developers.

### Package

- `packages/sdk`

### SDK principles

- typed request and response models
- API-first implementation
- auth and idempotency built in
- low-friction developer ergonomics

### SDK modules

- `client.health`
- `client.identity`
- `client.recipients`
- `client.envelopes`
- `client.intents`
- `client.payments`
- `client.settlements`
- `client.notifications`

### Example desired usage

```ts
const client = createMicrocosmClient({
  baseUrl: "http://localhost:3000",
  apiKey: process.env.MCOSM_API_KEY
});

const recipient = await client.recipients.resolve({
  email: "alice@gmail.com"
});

const payment = await client.payments.create({
  intentId: "intent_123",
  amount: "100.00",
  asset: "USDC",
  recipientId: recipient.id
});
```

### Exit criteria

- SDK wraps all public API endpoints
- SDK errors are typed
- example integrations compile and run

## 6.8 Workstream H: CLI

### Goal

Provide a developer and operator command surface built on top of the SDK.

### Package

- `packages/cli`

### Commands to build

- `mcosm health`
- `mcosm db apply-schema`
- `mcosm recipient resolve --email`
- `mcosm recipient claim --recipient-id`
- `mcosm envelope create --file`
- `mcosm envelope evaluate --id --file`
- `mcosm payment create --file`
- `mcosm payment execute --id`
- `mcosm payment status --id`
- `mcosm notifications list`
- `mcosm settlement replay --payment-id`

### Rules

- CLI should use the SDK
- CLI should not duplicate core business logic
- CLI should support machine-readable JSON output

### Exit criteria

- local development and admin flows can be exercised without hand-rolled curl commands

## 6.9 Workstream I: REST API

### Goal

Turn the current low-level handlers into a real stable API surface.

### Domains

- health
- recipients
- envelopes
- intents
- payments
- notifications
- settlements
- ledger

### Required improvements

- request validation
- response contracts
- idempotency support
- auth
- rate limits
- tenant and organization scoping
- pagination
- error model

### Example endpoints

- `GET /health`
- `GET /healthz`
- `GET /readyz`
- `POST /recipients/resolve`
- `GET /recipients/:id`
- `POST /recipients/:id/claim`
- `POST /envelopes`
- `GET /envelopes`
- `POST /intents`
- `GET /intents/:id`
- `POST /payments`
- `GET /payments/:id`
- `POST /payments/:id/execute`
- `POST /payments/:id/execute-async`
- `POST /payments/:id/claim`
- `GET /notifications`

### Exit criteria

- OpenAPI-specifiable backend
- stable developer-facing contract

## 7. Package-by-Package Plan

### apps/api

Should contain:

- runtime config
- startup entrypoint
- HTTP transport
- health/readiness
- request validation
- auth

### apps/worker

Should contain:

- settlement worker
- notification worker
- scheduler worker
- reconciliation worker

### packages/config

Should contain:

- environment parsing
- runtime defaults
- contract addresses
- venue enablement

### packages/db

Should contain:

- schema
- migrations
- query helpers
- repositories
- transactional helpers

### packages/identity

Should contain:

- user model
- recipient model
- claim logic
- wallet provisioning orchestration

### packages/envelopes

Should contain:

- envelope CRUD
- versioning
- policy metadata

### packages/intents

Should contain:

- intent creation
- evaluation state
- approval states

### packages/payments

Should contain:

- payment lifecycle
- payment status transitions
- persistence-aware orchestration

### packages/settlement

Should contain:

- Arc tx creation
- async execution
- settlement tracking
- claim settlement orchestration

### packages/notifications

Should contain:

- event emission
- provider routing
- delivery records

### packages/sdk

Should contain:

- typed API client
- auth helpers
- error handling

### packages/cli

Should contain:

- command definitions
- config loading
- JSON output mode

### packages/contracts

Should contain:

- Arc contracts
- Foundry tests
- deployment scripts

## 8. Deployment Model

The long-term runtime shape should be:

- API service
- worker service
- Postgres
- optional queue
- monitoring and logs

The minimum viable testnet deployment should require:

- one API process
- one worker process
- one Postgres instance
- Arc testnet credentials
- Privy credentials

## 9. Developer Experience Plan

The project should eventually support the following workflows cleanly:

### Local developer

- boot Postgres
- apply schema
- start API
- run worker
- run integration tests

### Integrator developer

- install SDK
- call recipient resolve
- create envelopes
- create payments
- inspect status

### Internal operator

- use CLI to resolve claims
- replay failed notifications
- inspect settlement health
- re-run reconciliation

## 10. Lockfile and Dependency Recovery

The current mobile workspace required a manual runtime dependency workaround because npm repeatedly failed on stale temp-directory renames inside `node_modules`.

On a proper development machine, the recovery sequence should be:

```bash
rm -rf node_modules package-lock.json
npm install
npm run typecheck
npm test
```

If only the lockfile is out of sync and install is otherwise stable:

```bash
npm install --package-lock-only
```

If stale temp directories appear again:

```bash
find node_modules -type d -name '.*-*' -prune -exec rm -rf {} +
```

This should be treated as workspace repair, not normal project usage.

## 11. PC Bootstrap Checklist

When you move development to a PC, the first checklist should be:

1. install Node and npm
2. install Docker or local Postgres
3. clone repo
4. run `npm install`
5. create `.env`
6. start Postgres
7. run `npm run db:apply-schema`
8. run `npm run check:api-runtime`
9. run `npm run start:api`
10. verify `GET /healthz` and `GET /readyz`

### Example Postgres bootstrap with Docker

```bash
docker run \
  --name microcosm-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=microcosm \
  -p 5432:5432 \
  -d postgres:16
```

## 12. Immediate Next Specs

Once this document is accepted, the next concrete docs to write are:

- `packages/cli` detailed specification
- full REST API specification
- Postgres migration plan beyond the first schema

Those should be written against the architecture in this plan, not independently improvised.
