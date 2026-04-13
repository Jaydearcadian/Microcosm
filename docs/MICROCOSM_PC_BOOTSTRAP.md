# Microcosm PC Bootstrap

## Goal

This is the shortest clean path to get Microcosm running on a normal PC with local Postgres.

## 1. Install prerequisites

You need:

- Node.js 22+ with npm
- Docker
- Git

Optional but useful:

- VS Code
- PostgreSQL client tools

## 2. Clone the repo

```bash
git clone <your-repo-url> microcosm
cd microcosm
```

## 3. Clean install dependencies

If the workspace is fresh:

```bash
npm install
```

If the lockfile or `node_modules` is broken:

```bash
rm -rf node_modules package-lock.json
npm install
```

## 4. Create `.env`

Set at least:

```env
ARC_NETWORK=testnet
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/microcosm

PRIVATE_KEY=<your-testnet-private-key>
ARC_SETTLEMENT_PRIVATE_KEY=<your-testnet-private-key>

PRIVY_APP_ID=<your-privy-app-id>
PRIVY_APP_SECRET=<your-privy-app-secret>

XMTP_ENV=dev
ENABLED_MARKETS=myriad,polymarket,hyperliquid,lighter
```

## 5. Start Postgres with Docker

```bash
docker run \
  --name microcosm-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=microcosm \
  -p 5432:5432 \
  -d postgres:16
```

Verify it is running:

```bash
docker ps
```

## 6. Apply schema

```bash
npm run db:apply-schema
```

Expected result:

```json
{
  "ok": true,
  "applied": true
}
```

## 7. Check runtime health

```bash
npm run check:api-runtime
```

Expected result:

- `postgres`: `ok`
- `arc_rpc`: `ok`
- `privy`: `ok`

## 8. Start API

```bash
npm run start:api
```

Expected result:

```json
{
  "ok": true,
  "service": "microcosm-api"
}
```

## 9. Verify endpoints

In another terminal:

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/healthz
curl http://127.0.0.1:3000/readyz
```

`/healthz` and `/readyz` should return HTTP `200` when Postgres, Arc RPC, and Privy config are all healthy.

## 10. Useful commands

```bash
npm run typecheck
npm test
npm run db:apply-schema
npm run check:api-runtime
npm run start:api
```

## 11. Common failures

### Postgres connection refused

Cause:

- Docker container not running

Fix:

```bash
docker start microcosm-postgres
```

### Arc RPC unhealthy

Cause:

- bad RPC URL or network issue

Fix:

- verify `ARC_TESTNET_RPC_URL`

### Privy config missing

Cause:

- missing `PRIVY_APP_ID` or `PRIVY_APP_SECRET`

Fix:

- correct `.env`

### NPM install broken

Fix:

```bash
rm -rf node_modules package-lock.json
npm install
```

## 12. Next step after bootstrap

Once the API boots cleanly:

1. implement persistent repositories for envelopes, intents, payments, settlements, and notifications
2. deploy Arc contracts
3. add worker runtime
4. build SDK
5. build CLI
