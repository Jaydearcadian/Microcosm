# Microcosm Agent Operations Guide

## 1. Purpose

This document is the operational handoff for the next coding agent that will continue Microcosm on a normal PC.

It is not an architecture pitch. It is a working guide for:

- how to read the repo efficiently
- what is already built
- what is partially built
- what is still blocked by this mobile environment
- where the next coding session should continue
- how to verify changes before claiming progress

Use this as the first document to orient a new coding agent.

## 2. Read Order

The next agent should read the repo in this order:

1. `README.md`
2. `docs/MICROCOSM_STATUS.md`
3. `docs/MICROCOSM_IMPLEMENTATION_MATRIX.md`
4. `docs/MICROCOSM_NEXT_STEPS.md`
5. `docs/MICROCOSM_INTEGRATIONS.md`
6. `docs/MICROCOSM_DEPLOYMENT_READINESS.md`
7. `docs/MICROCOSM_PC_BOOTSTRAP.md`

Then move into code in this order:

1. `apps/api/src/index.ts`
2. `apps/api/src/server.ts`
3. `apps/api/src/runtime.ts`
4. `apps/worker/src/index.ts`
5. `apps/worker/src/main.ts`
6. `packages/settlement/src/index.ts`
7. `packages/adapters/arc/src/index.ts`
8. `packages/db/src/postgres.ts`
9. `packages/contracts/src/*`
10. `packages/contracts/script/DeployArcContracts.s.sol`

After that, read the most relevant tests:

1. `apps/api/src/payments-flow.test.ts`
2. `apps/api/src/server.test.ts`
3. `apps/worker/src/index.test.ts`
4. `apps/worker/src/main.test.ts`
5. `packages/settlement/test/arc.test.ts`
6. `packages/adapters/arc/test/client.test.ts`
7. `packages/db/test/postgres.test.ts`

That order is intentional. It minimizes time wasted rebuilding context.

## 3. Current Product State

Microcosm is past the scaffold stage.

What is real today:

- API runtime exists
- worker runtime exists
- recipient and claim flow exists
- envelope and intent model exists
- payment lifecycle exists
- settlement records exist
- durable worker jobs exist
- worker lease and stale-lease reclaim exist
- settlement confirmation replay exists
- first-party Arc contract client exists
- Arc contract sources and Foundry tests exist
- deployment script and deployment manifest template exist
- detailed documentation and checkpoint archives exist

What is still not finished:

- real Arc testnet deployment outputs
- built-in production contract execution path validated on a normal machine
- claim flow integrated to real onchain escrow release
- API auth and idempotency
- developer SDK
- CLI
- live Postgres runtime validation on a proper machine

## 4. Current Verification Baseline

The repo was left in a clean verified state.

Before the handoff, the following were passing:

- `npm run typecheck`
- `npm test`
- `npm run contracts:test`

Expected test count at handoff:

- `69` JS and TS tests
- `2` Foundry tests

If a new agent does not see those pass on the PC, they should assume the environment changed and investigate before adding features.

## 5. Known Environment Caveats From This Mobile Workspace

These caveats matter because they explain some code choices.

### 5.1 Broken local `viem` package layout

In this mobile workspace, `node_modules/viem` is incomplete:

- missing package manifest
- missing some internal modules

Because of that, the Arc adapter uses a narrow compatibility shim with dynamic imports into workspace-local `viem/_esm` files and local deterministic helpers for some values.

This is a workaround for this workspace, not an ideal long-term design.

On the PC, after a clean install, the next agent should strongly consider:

1. deleting the workspace-local `viem` compatibility shim
2. switching `packages/adapters/arc/src/index.ts` back to normal `viem` imports
3. verifying all Arc adapter tests still pass

Do not do that blindly in this mobile workspace.

### 5.2 No working local Postgres runtime here

The code supports Postgres, but this environment did not have a running Postgres instance.

So:

- the Postgres repository code exists
- readiness checks exist
- schema apply tooling exists
- but local DB boot could not be fully exercised here

That should be one of the first things validated on the PC.

### 5.3 No real Arc deployment performed yet

Contracts compile and pass local Foundry tests, but they were not deployed from this environment.

The next agent should treat deployment as unfinished until:

- `forge script` is run on Arc testnet
- deployment outputs are captured
- env vars are updated
- API and worker are run against those real addresses

## 6. Current Runtime Surfaces

### API

Main files:

- `apps/api/src/index.ts`
- `apps/api/src/server.ts`
- `apps/api/src/main.ts`
- `apps/api/src/runtime.ts`

Important behavior:

- composes identity, payments, settlements, ledger, audit, notifications, worker jobs
- supports direct and claimable payments
- queues async payments into worker jobs
- can use first-party Arc client-backed settlement options

### Worker

Main files:

- `apps/worker/src/index.ts`
- `apps/worker/src/main.ts`

Important behavior:

- leases queued jobs
- can reclaim stale leases
- drains queued settlement jobs
- runs settlement confirmation passes

### Settlement

Main file:

- `packages/settlement/src/index.ts`

Important behavior:

- creates settlement plans
- stores settlement records
- marks settlements settled and claimed
- tracks confirmation state
- exposes confirmation loop
- supports first-party Arc client execution path

### Arc Client

Main file:

- `packages/adapters/arc/src/index.ts`

Important behavior:

- `settleDirect`
- `createClaimEscrow`
- `claimEscrow`
- `confirmTransaction`
- `getDirectSettlementEvents`

### Contracts

Main files:

- `packages/contracts/src/SettlementRouter.sol`
- `packages/contracts/src/ClaimEscrow.sol`
- `packages/contracts/test/SettlementFlows.t.sol`
- `packages/contracts/script/DeployArcContracts.s.sol`
- `packages/contracts/deployments/arc-testnet.example.json`

## 7. Where The Next Agent Should Continue

The next real frontier is:

1. deploy contracts to Arc testnet
2. write the real deployment manifest
3. wire those real addresses into `.env`
4. run API and worker against those addresses
5. validate direct settlement through the first-party Arc client on a normal machine
6. integrate claimable flow to real `ClaimEscrow`
7. then add API auth and idempotency

That is the right order.

Do not skip directly to SDK or CLI before confirming:

- contract deployment
- worker execution
- settlement confirmation
- DB-backed runtime boot

## 8. First Tasks On The PC

The first coding session on the PC should do this, in order:

1. clean install
```bash
rm -rf node_modules package-lock.json
npm install
```

2. verify baseline
```bash
npm run typecheck
npm test
npm run contracts:test
```

3. start Postgres

4. set real `.env`

5. apply schema
```bash
npm run db:apply-schema
```

6. check runtime
```bash
npm run check:api-runtime
```

7. start API and worker
```bash
npm run start:api
npm run start:worker
```

8. deploy contracts
```bash
npm run contracts:deploy:arc-testnet
```

9. write real addresses into:

- `ARC_SETTLEMENT_ROUTER_ADDRESS`
- `ARC_CLAIM_ESCROW_ADDRESS`

10. rerun API and worker against real addresses

## 9. How To Read The Checkpoints

Checkpoint archives exist under:

- `output/checkpoints/`

Android-exported copies exist under:

- `/storage/emulated/0/Download/microcosm-checkpoints/`

The newest checkpoint at the time of this guide is the current recovery point.

If a future agent is unsure what changed recently, they should:

1. open the latest checkpoint name
2. read `docs/MICROCOSM_STATUS.md`
3. read `docs/MICROCOSM_NEXT_STEPS.md`
4. inspect the files changed in the latest milestone area

## 10. Rules For The Next Coding Agent

The next agent should follow these rules:

- do not re-scaffold existing abstractions
- do not replace the current docs; extend them
- update the status docs after each meaningful milestone
- generate paired `.docx` files for new or updated docs
- create a checkpoint archive after each meaningful milestone
- keep verification evidence current before claiming success
- prefer test-first changes for behavior changes
- keep the reading order and continuation plan explicit

## 11. What Not To Waste Time On Next

Do not prioritize these yet:

- frontend polish
- CLI polish
- broad market-venue integrations
- new adapters unrelated to the payment core
- abstract refactors that do not move deployment readiness forward

The project is at the stage where real runtime validation matters more than new surface area.

## 12. Short Summary

If a new coding agent needs the shortest possible continuation instruction:

Read:

1. `docs/MICROCOSM_STATUS.md`
2. `docs/MICROCOSM_IMPLEMENTATION_MATRIX.md`
3. `docs/MICROCOSM_NEXT_STEPS.md`

Then do:

1. clean install on PC
2. verify `typecheck`, `test`, `contracts:test`
3. boot Postgres
4. deploy Arc contracts
5. wire real contract addresses
6. validate API plus worker against Arc testnet
7. integrate real escrow claim flow
8. add auth and idempotency

That is the correct continuation path.
