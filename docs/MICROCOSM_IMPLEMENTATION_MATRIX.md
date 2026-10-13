# Microcosm Implementation Matrix

## 1. Purpose

This document maps the current Microcosm codebase into a single implementation matrix.

Each row answers:

- what exists
- where it lives
- whether it is implemented, partial, or planned
- what persistence it has
- what integrations it depends on
- what the next action should be

Status labels used here:

- `built`: implemented and used in current code paths
- `partial`: implemented but incomplete, mock-backed, or not yet durable enough
- `planned`: specified or scaffolded but not meaningfully implemented yet

## 2. Application Layer

| Surface | Files | Status | Persistence | Tests | Current Role | Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| API application service | `apps/api/src/index.ts` | built | mixed JSON plus Postgres-backed app repository in async path | yes | composes identity, envelopes, intents, payments, settlements, ledger, audit, notifications, worker jobs, and first-party Arc client-backed settlement options | add auth, validation, and idempotency |
| HTTP server | `apps/api/src/server.ts` | built | n/a | yes | exposes current JSON API routes including worker job listing | add auth, validation, idempotency, org scoping |
| API runtime config | `apps/api/src/runtime.ts` | built | env | yes | loads runtime requirements, Arc RPC, and deployed contract addresses | add stronger config validation and deployment profiles |
| API health checks | `apps/api/src/health.ts` | built | n/a | indirectly | checks Postgres, Arc RPC, Privy config | add notification provider and worker readiness checks |
| API startup entrypoint | `apps/api/src/main.ts` | built | n/a | covered by runtime tests | boots service after readiness check | add structured logging and graceful shutdown |
| Schema apply tool | `apps/api/src/apply-schema.ts` | built | database | indirectly | applies base schema to Postgres | replace with migration runner once migrations are introduced |
| Worker app foundation | `apps/worker/src/index.ts` | partial | durable through async app repository or JSON fallback | yes | queues, leases, reclaims stale leases, lists, drains, and processes settlement execution jobs | add dequeue ownership persistence and backoff policies |
| Worker runtime entrypoint | `apps/worker/src/main.ts` | built | env plus async app repository | yes | boots a worker process and runs queued jobs plus settlement confirmation passes | add graceful shutdown and health reporting |

## 3. Core Domain Packages

| Package | Files | Status | Persistence | Tests | Current Role | Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| config | `packages/config/src/index.ts` | built | env | yes | central runtime config loader for adapters and examples | align config with app runtime and remove duplication |
| recipient-resolution | `packages/recipient-resolution/src/index.ts` | built | in-memory | yes | low-level recipient resolution primitives and types | keep as shared type layer under identity |
| identity | `packages/identity/src/index.ts` | built | repository-capable | yes | user and recipient lifecycle, pending claims, claim completion | extend to full user identity sync and org membership |
| policy-engine | `packages/policy-engine/src/index.ts` | built | none | yes | envelope rule evaluation | add richer policy conditions, approvals, and scheduling |
| envelopes | `packages/envelopes/src/index.ts` | partial | Postgres-backed through async app or JSON fallback | yes | envelope store and evaluation orchestration | add versioning and direct repository-backed service interfaces |
| intents | `packages/intents/src/index.ts` | partial | Postgres-backed through async app or JSON fallback | yes | intent creation and status storage | add event model and idempotency |
| payments | `packages/payments/src/index.ts` | partial | Postgres-backed through async app or JSON fallback | yes | payment lifecycle, sync execution, queued async execution, and claim transitions | add reconciliation fields and stronger status model |
| settlement | `packages/settlement/src/index.ts` | partial | dedicated settlement records plus payment-linked persistence | yes | direct and claimable settlement planning, settlement store, async execution path, Arc receipt confirmer, and confirmation replay loop | integrate with contract-aware execution and richer reconciliation policy |
| notifications | `packages/notifications/src/index.ts` | partial | Postgres-backed through async app or JSON fallback | yes | internal notification event service and webhook fanout | add provider adapters, retries, and delivery status |
| persistence | `packages/persistence/src/index.ts` | built | JSON file | yes | local state persistence for app snapshots | retain only for dev fallback once DB repositories exist |
| sdk | `packages/sdk/src/index.ts` | partial | n/a | yes | early adapter and client composition entrypoint | turn into real HTTP SDK with stable public API |

## 4. Database Layer

| Package | Files | Status | Persistence | Tests | Current Role | Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| db package entrypoint | `packages/db/src/index.ts` | built | n/a | indirectly | export surface for DB helpers | keep as package boundary |
| Postgres client wrapper | `packages/db/src/postgres.ts` | built | Postgres | yes | runtime pg loading and identity plus app-state repositories including settlements, ledger, audit, and worker jobs | add query models and read-side helpers |
| base schema | `packages/db/postgres/schema.sql` | built | Postgres | yes | creates users, organizations, agents, wallets, recipients, envelopes, intents, payments, settlements, notifications, ledger entries, audit events, and worker jobs | add real migration runner and later read models |

## 5. Adapter Packages

| Adapter | Files | Status | Persistence | Tests | Current Role | Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| privy | `packages/adapters/privy/src/index.ts` | built | Privy service | yes | server adapter and wallet provisioner used by identity claim flow | add richer user and wallet sync operations |
| xmtp | `packages/adapters/xmtp/src/index.ts` | partial | XMTP transport | yes | runtime adapter exists | connect to notifications and agent communications |
| allium | `packages/adapters/allium/src/index.ts` | partial | external service | yes | runtime data adapter exists | connect to data service, observability, and enrichment jobs |
| arc | `packages/adapters/arc/src/index.ts` | built | Arc RPC and contract addresses | yes | first-party Arc contract client for direct settlement, escrow creation and claims, receipt confirmation, and event reads | deploy to Arc testnet and harden the runtime path on a clean machine |
| uniblock | `packages/adapters/uniblock/src/index.ts` | planned | external service | no | package shell only | add RPC failover client or remove until needed |
| registry | `packages/adapters/registry/src/index.ts` | built | none | yes | adapter metadata registry | keep updated as adapters become real |
| myriad | `packages/adapters/myriad/src/index.ts` | planned | external service | no | package shell only | build venue adapter only after payment core is durable |
| polymarket | `packages/adapters/polymarket/src/index.ts` | planned | external service | no | package shell only | same as above |
| hyperliquid | `packages/adapters/hyperliquid/src/index.ts` | planned | external service | no | package shell only | same as above |
| lighter | `packages/adapters/lighter/src/index.ts` | planned | external service | no | package shell only | same as above |

## 6. Contracts

| Surface | Files | Status | Persistence | Tests | Current Role | Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| foundry scaffold | `packages/contracts/foundry.toml` | built | Arc chain | yes | Foundry project config with passing local tests | keep aligned with contract package growth |
| SettlementRouter | `packages/contracts/src/SettlementRouter.sol` | built | Arc chain | yes | direct token settlement routing and event emission | deploy to Arc testnet and wire runtime addresses |
| ClaimEscrow | `packages/contracts/src/ClaimEscrow.sol` | built | Arc chain | yes | ERC-20 escrow creation and owner-authorized claims | deploy to Arc testnet and integrate recipient claim flow with onchain release |
| Deployment script and manifest | `packages/contracts/script/DeployArcContracts.s.sol`, `packages/contracts/deployments/arc-testnet.example.json` | built | Arc chain | indirectly | deploys router and escrow contracts and defines the manifest shape | run on Arc testnet and commit real deployment outputs |
| Mock token and Foundry tests | `packages/contracts/src/test/MockERC20.sol`, `packages/contracts/test/SettlementFlows.t.sol` | built | local test only | yes | local contract verification for direct settlement and escrow claims | add Arc deployment scripts and negative-path tests |

## 7. API Endpoint Matrix

| Endpoint | Status | Backing Logic | Durable Today | Notes | Next Action |
| --- | --- | --- | --- | --- | --- |
| `GET /health` | built | server | yes | simple liveness | keep |
| `GET /healthz` | built | runtime health | yes | checks Postgres, Arc RPC, Privy config | add worker and notification provider checks |
| `GET /readyz` | built | runtime health | yes | currently same logic as `healthz` | differentiate readiness from health later |
| `POST /recipients/resolve` | built | identity | partial | durable only when Postgres is available | add auth and input validation |
| `GET /recipients` | built | identity | partial | depends on runtime backing store | add pagination |
| `GET /recipients/:id` | built | identity | partial | same limitation | keep |
| `POST /recipients/:id/claim` | built | identity plus Privy | partial | durable for identity only | add claim tokens and notification flow |
| `POST /envelopes` | built | envelopes | partial | durable through async app repository path | add org scoping and validation |
| `GET /envelopes` | built | envelopes | partial | same limitation | add pagination and filtering |
| `POST /intents` | built | intents | partial | durable through async app repository path | add idempotency |
| `GET /intents` | built | intents | partial | same limitation | add pagination and filtering |
| `GET /intents/:id` | built | intents | partial | same limitation | keep |
| `POST /payments` | built | payments | partial | durable through async app repository path | add idempotency |
| `GET /payments` | built | payments | partial | same limitation | add pagination and filtering |
| `GET /payments/:id` | built | payments | partial | same limitation | keep |
| `POST /payments/:id/execute` | built | payments plus settlement | partial | settlement record is durable, execution is still inline | add authorization and safer execution contract |
| `POST /payments/:id/execute-async` | built | payments plus worker jobs | partial | queues durable work and can use contract-aware settlement submitters | add auth and external idempotency |
| `POST /payments/:id/claim` | built | payments | partial | settlement record is durable, claim path is still application-state only | replace with contract-aware claim path |
| `GET /settlements` | built | settlements | partial | durable through async app repository path | add pagination and filtering |
| `GET /settlements/:id` | built | settlements | partial | same limitation | add richer settlement query model |
| `GET /notifications` | built | notifications | partial | durable through async app repository path | add provider delivery status |
| `GET /jobs` | built | worker jobs | partial | durable through async app repository path | add filtering, get-by-id, and operational lease fields |

## 8. Runtime Dependency Matrix

| Dependency | Current Use | Status | Required Env | Failure Mode Today | Next Action |
| --- | --- | --- | --- | --- | --- |
| Arc RPC | health checks and settlement path | built | `ARC_TESTNET_RPC_URL` | degraded health | keep and add tx confirmation watcher |
| Privy | wallet provisioning and config validation | built | `PRIVY_APP_ID`, `PRIVY_APP_SECRET` | claim provisioning unavailable | add richer identity sync |
| Postgres | identity plus app-state repositories and schema tool | partial | `DATABASE_URL` | boot blocked when DB not running | add live runtime bring-up and migration runner |
| Circle AppKit | async direct settlement path | partial | settlement key and runtime config | settlement falls back or fails | keep only as fallback once the first-party Arc client is used for the main path |
| XMTP | adapter only | partial | XMTP env vars | no communication delivery | connect to notifications |
| Allium | adapter only | partial | `ALLIUM_API_KEY`, `ALLIUM_API_URL` | no data enrichment | connect to observability and data jobs |
| Myriad | package shell | planned | venue-specific | no effect | defer until payment core matures |
| Polymarket | package shell | planned | venue-specific | no effect | defer until payment core matures |
| Hyperliquid | package shell | planned | venue-specific | no effect | defer until payment core matures |
| Lighter | package shell | planned | venue-specific | no effect | defer until payment core matures |
| Uniblock | package shell | planned | provider credentials | no effect | add only when RPC failover is needed |

## 9. Test Coverage Matrix

| Area | Tests Present | Confidence Level | Main Gap |
| --- | --- | --- | --- |
| config | yes | medium | deployment profile coverage |
| identity | yes | medium-high | live Privy integration behavior |
| recipient resolution | yes | medium | persistence edge cases under DB failures |
| envelopes | yes | medium | no repository coverage |
| intents | yes | medium | no idempotency or event sourcing coverage |
| payments | yes | medium | no durable settlement persistence |
| settlement | yes | medium | no live contract execution and replay loop |
| notifications | yes | medium | no provider retry semantics |
| Postgres identity repo | yes | medium-high | still no live DB execution in this environment |
| Postgres app-state repo | yes | high | no live DB execution in this environment |
| API service | yes | medium | no authenticated HTTP contract coverage |
| HTTP server | yes | medium | no high-volume or malformed request coverage |
| worker | yes | medium-high | no durable lease ownership columns or dead-letter policy |
| contracts | yes | medium | not integrated into the app submission path yet |
| CLI | no | none | CLI not implemented |

## 10. Highest Priority Build Queue

Priority order from current state:

1. boot Postgres on the development machine
2. apply the base schema successfully
3. make API readiness fully green
4. boot the API against live Postgres on a normal PC
5. deploy real Arc testnet contract addresses and commit the manifest
6. add durable lease ownership and reconciliation backoff in the worker
7. add API auth and idempotency
8. finish SDK
9. build CLI

## 11. What Should Not Be Prioritized Yet

These would be premature at the current stage:

- frontend console polish
- market-data venue integrations as first-class runtime dependencies
- advanced agent tooling
- CLI polish before the SDK and HTTP API stabilize
- moving complex policy logic onchain

## 12. Summary

Microcosm currently has a coherent backend skeleton with real code in the critical path.

The repo is strongest in:

- runtime setup
- identity and recipients
- payment orchestration
- partial Arc settlement
- documentation

The repo is weakest in:

- reconciliation and confirmation handling
- contract integration into the app runtime
- production-grade notifications
- SDK and CLI product surfaces
