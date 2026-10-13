# Microcosm

Microcosm, short form `mcosm`, is an Arc-native programmable payment layer for the open internet.

The product goal is straightforward:

- let users and businesses send USDC-based payments on Arc using email, Google identity, or agent identity instead of raw wallet addresses
- let recipients get notified, claim funds, and receive a self-custodial or provisioned wallet
- let organizations define payment envelopes that control who can spend, how much, when, under what schedule, and through which settlement path
- let agents automate bill pay, payroll, disbursements, treasury movements, and settlement while staying inside explicit policy controls

This repository contains the backend foundation for that system:

- Arc settlement planning and async execution paths
- Privy-backed identity and wallet provisioning hooks
- recipient resolution and claim flows
- envelope and intent evaluation
- payment and settlement services
- async API runtime with health and readiness checks
- Postgres schema and repository boundary

## Current State

The codebase is no longer a toy sketch, but it is not yet a finished product. The following pieces exist today:

- typed runtime configuration
- `@mcosm` adapter packages for Arc, Privy, XMTP, Allium, and market venues
- persistent recipient and identity model
- payment creation and claim flows
- health and readiness checks
- Postgres repository boundary for identity
- Arc testnet runtime support

The following pieces still need to be completed for a production-quality testnet deployment:

- live Postgres runtime and migrations beyond the first schema
- contract deployment on Arc testnet
- real escrow contract flow for unclaimed recipients
- repository layers for envelopes, intents, payments, settlements, notifications, and ledger
- async workers for settlement, notification, reconciliation, and scheduling
- first-class SDK and CLI surfaces
- operational deployment scripts and dashboards

## Documentation

Product and implementation baselines:

- [Product Requirements Document](./docs/MICROCOSM_PRD.md)
- [Technical Specification](./docs/MICROCOSM_TECHNICAL_SPEC.md)
- [Detailed Build Plan](./docs/MICROCOSM_BUILD_PLAN.md)
- [REST API Specification](./docs/MICROCOSM_REST_API_SPEC.md)
- [Integration Architecture](./docs/MICROCOSM_INTEGRATIONS.md)
- [Deployment Readiness](./docs/MICROCOSM_DEPLOYMENT_READINESS.md)

## Local Runtime

Environment is read from `.env`.

Important variables:

- `DATABASE_URL`
- `PRIVY_APP_ID`
- `PRIVY_APP_SECRET`
- `ARC_SETTLEMENT_PRIVATE_KEY`
- `ARC_TESTNET_RPC_URL`
- `ARC_SETTLEMENT_ROUTER_ADDRESS`
- `ARC_CLAIM_ESCROW_ADDRESS`

Useful commands:

```bash
npm run typecheck
npm test
npm run check:api-runtime
npm run db:apply-schema
npm run start:api
npm run start:worker
```

## Arc Contracts

The contracts package now contains:

- `SettlementRouter`
- `ClaimEscrow`

Useful commands:

```bash
cd packages/contracts
forge test
forge script script/DeployArcContracts.s.sol:DeployArcContracts \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --broadcast
```

After deployment, write the resulting addresses into:

- `ARC_SETTLEMENT_ROUTER_ADDRESS`
- `ARC_CLAIM_ESCROW_ADDRESS`

Those values are now read by both the API and worker runtime.

## Expected Local Bootstrap

On a real development machine, the expected order is:

1. start PostgreSQL
2. set `.env`
3. run `npm install`
4. run `npm run db:apply-schema`
5. run `npm run check:api-runtime`
6. run `npm run start:api`

If `check:api-runtime` reports degraded status, do not try to continue feature work until the runtime dependency that is failing is fixed.

## Architecture Summary

Microcosm should mature into these layers:

- identity layer
- recipient resolution layer
- policy and envelope layer
- payment and intent layer
- settlement layer
- communications layer
- audit and observability layer
- developer surface layer

The canonical backend interfaces should remain:

- API first
- SDK second
- CLI third
- agent tools fourth

## Immediate Next Build Areas

The most important next engineering work is:

1. finish database-backed repositories across all domains
2. deploy Arc settlement and escrow contracts
3. move settlement and notifications into async workers
4. build the SDK and CLI
5. add a proper readiness gate for deployed environments

## Lockfile Note

This workspace currently runs, typechecks, and tests correctly, but the `package-lock.json` is not guaranteed to reflect every runtime dependency because `pg` was vendored manually after npm hit repeated stale temp-directory rename failures inside `node_modules`.

On a normal PC, the correct reset is:

```bash
rm -rf node_modules package-lock.json
npm install
npm run typecheck
npm test
```

That should be treated as part of the first clean-machine bootstrap.
