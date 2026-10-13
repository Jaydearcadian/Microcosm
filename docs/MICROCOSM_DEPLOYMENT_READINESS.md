# Microcosm Deployment Readiness

## 1. Purpose

This document describes how close the current repository is to being deployable and what has been added to improve that state before moving work to a PC.

The goal is not to claim production readiness. The goal is to maximize handoff quality and reduce the remaining operational gap.

## 2. What Is Deployment-Ready Enough Today

The repository now has a usable deployment shape for local and testnet-oriented backend boot:

- a `Dockerfile` for the API runtime
- a `docker-compose.yml` stack for API plus Postgres
- a `.dockerignore`
- runtime health and readiness checks
- a schema apply script
- a boot entrypoint
- a PC bootstrap guide
- a checkpoint and backup script

These additions mean the repo now has a coherent path for:

- local containerized boot on a normal PC
- easier runtime verification
- repeatable checkpoint backups during development

## 3. What The Deployment Bundle Includes

### Dockerfile

Current file:

- `Dockerfile`

Purpose:

- install dependencies with `npm ci`
- copy the application source
- expose port `3000`
- start the API with `npm run start:api`

This is intentionally simple. It favors reproducibility over optimization at this stage.

### Docker Compose Stack

Current file:

- `docker-compose.yml`

Services:

- `postgres`
- `api`

The API container waits on Postgres health, applies the base schema, and then starts the API.

This is the right short-term shape for local and testnet-oriented backend iteration.

### Docker Ignore

Current file:

- `.dockerignore`

Purpose:

- exclude `node_modules`
- exclude `.env`
- exclude generated output and checkpoints

This keeps secrets and large local artifacts out of the container build context.

## 4. What Is Still Not Deployment-Ready

Even with the new deployment artifacts, the repo is still not truly deployable as a reliable payment product until the following are completed:

- full Postgres repositories for non-identity domains
- worker service implementation
- Arc contracts
- settlement reconciliation
- real notification providers
- auth and tenant scoping
- internal ledger and audit persistence

The deployment assets improve startup quality. They do not eliminate core product incompleteness.

## 5. Current Deployment Risks

### No Full Durable Persistence

Current durable repository support is strongest for identity.

Major runtime domains still depend on in-memory or JSON-backed state:

- envelopes
- intents
- payments
- notifications

This means a running container does not yet imply durable product behavior.

### No Worker Runtime

The API still handles too much execution responsibility directly.

Without workers:

- async execution is fragile
- retries are limited
- reconciliation is missing

### No Contract-Backed Claim Escrow

Claimable payments are still application-state transitions rather than onchain escrow flows.

That is acceptable for current backend iteration and unacceptable for the finished product.

## 6. Recommended Deployment Sequence On PC

Once moved to a PC, use this sequence:

1. run a clean install
2. start the Docker stack
3. confirm Postgres is healthy
4. confirm schema application succeeds
5. confirm `/readyz` returns healthy
6. add repositories for the remaining core payment domains
7. add workers
8. add contracts

## 7. Runtime Commands

Current commands:

```bash
npm run typecheck
npm test
npm run db:apply-schema
npm run check:api-runtime
npm run start:api
```

Container path on a PC:

```bash
docker compose up --build
```

## 8. How To Interpret “Deployment Ready” For Microcosm

At this stage, “deployment ready” should mean:

- can be booted reliably on a PC
- can be reproduced by another environment
- can be checkpointed safely
- has a documented startup path

It should not yet mean:

- production safe
- financially complete
- fully durable
- operationally mature

## 9. Summary

The repository is now materially closer to deployable because it has:

- a containerized boot path
- startup orchestration for API plus Postgres
- secret-safe backup tooling
- stronger execution-state documentation

The next work required to go beyond this is domain durability, workers, contracts, and reconciliation.

