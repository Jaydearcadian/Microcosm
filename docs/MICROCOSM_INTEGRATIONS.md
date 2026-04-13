# Microcosm Integrations Architecture

## 1. Purpose

This document maps the external tools, SDKs, protocols, and infrastructure systems used by Microcosm.

The goal is to answer, for every external integration:

- why it exists
- whether it is core or optional
- where it belongs in the codebase
- whether it is request-path or async-path
- which APIs and workers depend on it
- what secrets and runtime config it needs
- what failure modes it introduces

This is the missing bridge between the platform architecture and the actual systems we are integrating.

## 2. Integration Classification

Microcosm should classify integrations into five groups:

### 2.1 Core settlement and identity integrations

These are mandatory:

- Arc
- Privy
- Postgres

### 2.2 Core communications and observability integrations

These are near-core:

- XMTP
- Allium

### 2.3 Reliability and chain access integrations

These are strongly recommended:

- Uniblock

### 2.4 Money movement and fiat-adjacent integrations

These are optional for initial testnet but strategically important:

- MoonPay
- Open Wallet Standard

### 2.5 Market and external data integrations

These are optional and should remain adapterized:

- Myriad
- Polymarket
- Hyperliquid
- Lighter

## 3. Integration Matrix

## 3.1 Arc

### Role

Arc is the primary settlement rail for Microcosm.

### Why it exists

- USDC-centered settlement
- predictable fee model
- deterministic finality
- strong fit for programmable payments

### Core or optional

- core

### Package owner

- `packages/settlement`
- `packages/contracts`
- `packages/adapters/arc`

### Used by

- payment execution
- claim settlement
- settlement worker
- health/readiness checks

### Request-path or async-path

- both
- planning and status can happen on request path
- real transaction submission should move to async worker

### API touchpoints

- `POST /payments/:id/execute`
- `POST /payments/:id/execute-async`
- future `GET /settlements/:id`

### Worker touchpoints

- settlement worker
- reconciliation worker

### Runtime config

- `ARC_NETWORK`
- `ARC_TESTNET_RPC_URL`
- `ARC_MAINNET_RPC_URL`
- `ARC_SETTLEMENT_PRIVATE_KEY`

### Failure modes

- RPC unavailable
- mispriced fees
- tx submission failure
- tx finality tracking failure

### Fallback behavior

- block startup if Arc RPC is unavailable in production
- return degraded health
- do not silently mark settlements complete

### Build priority

- immediate and permanent

## 3.2 Privy

### Role

Privy is the identity-linked wallet provisioning and credential-backed user wallet integration layer.

### Why it exists

- email and social identity linkage
- embedded or provisioned wallets
- wallet ownership tied to user identity
- server-side wallet creation hooks

### Core or optional

- core

### Package owner

- `packages/adapters/privy`
- `packages/identity`

### Used by

- recipient claim flow
- wallet provisioning
- user identity persistence
- startup validation

### Request-path or async-path

- request-path for claim and onboarding
- async-path later for reconciliation and repair

### API touchpoints

- `POST /recipients/:id/claim`
- future `POST /recipients/invite`
- future `POST /claims/complete`

### Worker touchpoints

- identity reconciliation worker later

### Runtime config

- `PRIVY_APP_ID`
- `PRIVY_APP_SECRET`
- optional `PRIVY_API_URL`

### Failure modes

- missing credentials
- wallet provisioning failure
- user and wallet state drift

### Fallback behavior

- if wallet provisioning fails, claim flow must fail explicitly
- do not create claimed recipients with phantom wallets

### Build priority

- immediate and permanent

## 3.3 Postgres

### Role

Postgres is the primary persistent system of record.

### Why it exists

- relational integrity
- durable state
- transactional writes
- migration support

### Core or optional

- core

### Package owner

- `packages/db`

### Used by

- identity persistence
- recipient persistence
- future envelopes, intents, payments, settlements, notifications, ledger, audit

### Request-path or async-path

- both

### API touchpoints

- effectively all stateful endpoints

### Worker touchpoints

- all workers

### Runtime config

- `DATABASE_URL`

### Failure modes

- connection refused
- schema missing
- query failure
- migration drift

### Fallback behavior

- readiness must fail
- startup should fail for production runtime

### Build priority

- immediate and permanent

## 3.4 XMTP

### Role

XMTP is the communications rail for wallet-native and agent-native messaging.

### Why it exists

- recipient and agent messaging
- payment notifications
- structured machine-readable communication
- future agent-to-agent coordination

### Core or optional

- near-core

### Package owner

- `packages/adapters/xmtp`
- `packages/notifications`

### Used by

- payment notifications
- claim notifications
- future approval requests
- future agent communications

### Request-path or async-path

- async-path

### API touchpoints

- none directly at first
- indirect through notification creation

### Worker touchpoints

- notification worker

### Runtime config

- `XMTP_ENV`
- `XMTP_DB_PATH`
- `XMTP_API_URL`
- `XMTP_HISTORY_SYNC_URL`

### Failure modes

- delivery failure
- local XMTP store corruption
- identity mismatch between recipient record and XMTP identity

### Fallback behavior

- keep notification record
- retry through worker
- degrade communication, not core settlement

### Build priority

- phase after email notifications

## 3.5 Allium

### Role

Allium is the data and observability layer.

### Why it exists

- chain and wallet analytics
- balances and holdings
- price and historical enrichment
- monitoring and reconciliation support

### Core or optional

- near-core for observability
- optional for first minimal payment execution

### Package owner

- `packages/adapters/allium`
- future `packages/data`

### Used by

- observability dashboards
- reconciliation
- analytics
- future treasury intelligence

### Request-path or async-path

- mostly async-path

### API touchpoints

- future analytics endpoints
- future health diagnostics

### Worker touchpoints

- reconciliation worker
- reporting worker

### Runtime config

- `ALLIUM_API_KEY`
- optional `ALLIUM_API_URL`

### Failure modes

- stale analytics
- missing enrichment
- degraded reporting

### Fallback behavior

- do not block settlement
- mark analytics features degraded

### Build priority

- after core runtime

## 3.6 Uniblock

### Role

Uniblock is the chain access and RPC abstraction layer.

### Why it exists

- RPC redundancy
- failover
- potential cross-chain routing support

### Core or optional

- recommended

### Package owner

- `packages/adapters/uniblock`
- `packages/settlement`

### Used by

- Arc submission fallback
- cross-chain expansion later

### Request-path or async-path

- async-path primarily

### API touchpoints

- indirect only

### Worker touchpoints

- settlement worker
- reconciliation worker

### Runtime config

- `UNIBLOCK_API_KEY`

### Failure modes

- fallback routing unavailable

### Fallback behavior

- continue with direct Arc RPC if available

### Build priority

- after local runtime stabilization

## 3.7 MoonPay

### Role

MoonPay is a money movement and fiat-adjacent integration layer, not the core payment rail.

### Why it exists

- fiat on-ramp and off-ramp
- wallet-adjacent flows
- deposit and funding flows
- potential agent skills for money movement

### Core or optional

- optional initially

### Package owner

- future `packages/adapters/moonpay`
- future `packages/funding`

### Used by

- account funding
- treasury top-up
- fiat-adjacent workflows

### Request-path or async-path

- mostly async-path

### API touchpoints

- future `/funding/*`

### Worker touchpoints

- deposit monitoring
- funding workflow worker

### Runtime config

- MoonPay credentials later

### Failure modes

- funding flow unavailable

### Fallback behavior

- do not block core Arc-native settlement

### Build priority

- after payment core and notifications

## 3.8 Open Wallet Standard

### Role

Open Wallet Standard is the wallet abstraction boundary.

### Why it exists

- prevents product logic from depending on a single wallet vendor shape
- standardizes wallet interaction surfaces

### Core or optional

- strategically important
- not a runtime dependency in the same way as Arc or Privy

### Package owner

- future `packages/wallet-standard`

### Used by

- SDK and frontend wallet abstractions
- future external-wallet support

### Request-path or async-path

- client-side and SDK-side primarily

### Build priority

- before serious external wallet support

## 3.9 Myriad

### Role

Prediction-market adapter for agent and market workflows.

### Why it exists

- prediction market access
- market-based automation possibilities

### Core or optional

- optional

### Package owner

- `packages/adapters/myriad`

### Used by

- future market-aware agent workflows
- future treasury or signal-driven systems

### Request-path or async-path

- adapter-specific
- should remain outside core payment request path

### Runtime config

- `MYRIAD_API_KEY`

### Build priority

- after SDK and CLI

## 3.10 Polymarket

### Role

Prediction-market venue and live market-data source.

### Why it exists

- live market data
- venue-specific execution and analytics later

### Core or optional

- optional

### Package owner

- `packages/adapters/polymarket`

### Runtime config

- `POLYMARKET_API_KEY`

### Use in Microcosm

- optional market intelligence
- not core payment execution

## 3.11 Hyperliquid

### Role

Perps and market-data adapter.

### Core or optional

- optional

### Package owner

- `packages/adapters/hyperliquid`

### Runtime config

- `HYPERLIQUID_API_KEY`

### Use in Microcosm

- live market data
- treasury or agent intelligence
- not part of core payment path

## 3.12 Lighter

### Role

Venue-specific market and data adapter.

### Core or optional

- optional

### Package owner

- `packages/adapters/lighter`

### Runtime config

- `LIGHTER_API_KEY`

### Use in Microcosm

- venue intelligence
- optional agent workflows

## 4. Package Ownership Summary

### Core packages

- `packages/identity`
- `packages/payments`
- `packages/settlement`
- `packages/db`
- `packages/notifications`

### Adapter packages

- `packages/adapters/arc`
- `packages/adapters/privy`
- `packages/adapters/xmtp`
- `packages/adapters/allium`
- `packages/adapters/uniblock`
- `packages/adapters/myriad`
- `packages/adapters/polymarket`
- `packages/adapters/hyperliquid`
- `packages/adapters/lighter`

### Future packages

- `packages/adapters/moonpay`
- `packages/wallet-standard`
- `packages/data`
- `packages/cli`

## 5. Runtime Placement

### Request path

Use only when the operation is latency-sensitive and core:

- Postgres
- Privy claim and provisioning
- Arc planning

### Async path

Use for side effects and retries:

- Arc final execution
- XMTP notifications
- Allium enrichment
- MoonPay funding
- market data refresh

## 6. Operational Priorities

### Immediate

- Arc
- Privy
- Postgres

### Near-term

- XMTP
- Uniblock
- Allium

### Later

- MoonPay
- Open Wallet Standard
- Myriad
- Polymarket
- Hyperliquid
- Lighter

## 7. Health and Readiness Expectations

### Must be green for readiness

- Postgres
- Arc RPC
- Privy config

### Can be degraded without blocking startup initially

- XMTP
- Allium
- Uniblock
- market adapters
- MoonPay

As the product matures, some of these may be promoted into readiness gates depending on critical path usage.

## 8. Recommended Next Documentation Work

This integrations doc should be kept in sync with:

- `MICROCOSM_BUILD_PLAN.md`
- `MICROCOSM_REST_API_SPEC.md`
- `MICROCOSM_CLI_SPEC.md`
- `MICROCOSM_POSTGRES_MIGRATION_PLAN.md`

The next practical update should be adding:

- exact env var table
- exact package ownership table
- endpoint-by-endpoint dependency matrix
- worker-by-worker dependency matrix
