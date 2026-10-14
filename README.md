# Microcosm

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-success?style=flat&logo=vercel)](https://charcoal-brown.vercel.app)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Public-blue?style=flat&logo=github)](https://github.com/Jaydearcadian/Microcosm)
[![Network](https://img.shields.io/badge/Arc_Network-Mainnet_5042_%7C_Testnet_5042002-blueviolet)](#network-configuration)
[![USDC Contract](https://img.shields.io/badge/Arc_USDC-0x3600...0000-green)](#network-configuration)

Microcosm is an Arc-native programmable payments and multi-tenant financial coordination protocol. It introduces **Spaces**—bounded operating environments for people, autonomous agents, money, and policy rules—that decouple transaction intent authorization from cryptographic onchain execution.

---

## Live Links & Release Status

- **Production Consumer Web App:** [https://charcoal-brown.vercel.app](https://charcoal-brown.vercel.app)
- **Public GitHub Repository:** [https://github.com/Jaydearcadian/Microcosm](https://github.com/Jaydearcadian/Microcosm)
- **Arc Testnet Verified Settlement:** Tx [`0xb9ff68b720ccc128a8791435979dd08b50ea16d189df212a0e4a256b321be408`](https://testnet.arcscan.app/tx/0xb9ff68b720ccc128a8791435979dd08b50ea16d189df212a0e4a256b321be408) (Block `67174208`)

---

## Architecture: Microcosm → Spaces → Money & Rules → Settlement

```mermaid
flowchart TD
    subgraph Client ["Client Layer (apps/web)"]
        UI["Responsive Consumer Web UI (Vercel)"]
        Privy["Privy Social & Wallet Auth"]
        WalletSign["Non-Custodial Client Wallet Signing"]
    end

    subgraph API ["Control Plane (apps/api & packages)"]
        Dispatcher["/v1 Centralized Route Dispatcher"]
        AuthBoundary["Canonical Principal & Space Resolution"]
        Intents["Payment Intent & Envelope Engine"]
        Postgres["PostgreSQL Persistence (Concurrency Locks)"]
    end

    subgraph ArcSettlement ["Arc Onchain Settlement Layer"]
        FailClosed["Fail-Closed Runtime (Chain ID 5042 / 5042002)"]
        ArcUSDC["Official Arc USDC Contract (0x3600...0000)"]
        Verifier["Receipt Verifier (verifyUsdcTransfer)"]
        Worker["Durable Async Worker (FOR UPDATE SKIP LOCKED)"]
    end

    UI -->|Bearer Session Token| Dispatcher
    Dispatcher --> AuthBoundary
    AuthBoundary --> Intents
    Intents -->|Prepare Payment Calldata| WalletSign
    WalletSign -->|Sign & Broadcast| ArcUSDC
    UI -->|Submit TxHash| Dispatcher
    Dispatcher -->|Queue Job| Postgres
    Worker -->|Poll & Claim Job| Postgres
    Worker -->|Fetch Receipt & Verify Logs| Verifier
    Verifier --> ArcUSDC
    Verifier -->|Mark Confirmed| Postgres
```

### Core Architecture Principles
1. **Canonical Identity Decoupled from Providers:** Internal Microcosm principals are permanent and independent of email addresses, social logins, or raw wallet addresses.
2. **Multi-Tenant Spaces Isolation:** All accounts, recipients, envelopes, intents, payments, and audit logs are scoped strictly to a Space. Adversarial cross-Space lookups return non-leaking 404 errors.
3. **Intent-Bound Client Wallet Signing:** The consumer API holds zero server private keys (`ARC_SETTLEMENT_PRIVATE_KEY` is disallowed on consumer routes). The backend prepares exact ERC-20 `transfer` calldata bound to an approved intent; the user reviews and signs the transaction directly from their wallet.
4. **Receipt-Gated Confirmation:** A submitted transaction hash is recorded as `"submitted"`. The payment only transitions to `"confirmed"` when the independent onchain receipt verifier confirms the ERC-20 `Transfer` topic, the official USDC contract address, sender, recipient, and exact integer base-unit amount.
5. **Zero Float Currency Arithmetic:** All token amounts are strictly parsed and formatted as exact integer base units (`BigInt`, 6 decimals for USDC) to prevent IEEE 754 floating-point rounding errors.

---

## Network Configuration

Microcosm runs with strict, fail-closed chain ID and token contract validation:

| Parameter | Arc Mainnet (Production) | Arc Testnet |
| :--- | :--- | :--- |
| **Chain ID** | `5042` | `5042002` |
| **RPC URL** | `https://rpc.mainnet.arc.io/` | `https://rpc.testnet.arc.network` |
| **Official USDC Token** | `0x3600000000000000000000000000000000000000` | `0x3600000000000000000000000000000000000000` |
| **Token Decimals** | `6` | `6` |
| **Block Explorer** | [arcscan.app](https://arcscan.app) | [testnet.arcscan.app](https://testnet.arcscan.app) |

The runtime actively calls `eth_chainId` on boot and refuses readiness if the remote RPC reports a chain ID mismatch. Production never silently falls back to testnet.

---

## Monorepo Structure

```
├── apps/
│   ├── web/                     # Next.js 15 + React 19 consumer responsive application
│   ├── api/                     # Centralized /v1 REST API control plane & dispatcher
│   └── worker/                  # Durable settlement verification worker (Postgres queue)
├── packages/
│   ├── api-contracts/           # Zod schemas and inferred types for all API endpoints
│   ├── identity/                # Canonical principal resolution & EIP-191 challenge verification
│   ├── spaces/                  # Multi-tenant Space domain models & authorization
│   ├── db/                      # PostgreSQL client, migrations, and concurrency locks
│   ├── intents/                 # Payment intent evaluation & policy envelopes
│   ├── payments/                # Payment state machine & transition rules
│   ├── config/                  # Fail-closed typed runtime configuration
│   └── adapters/
│       └── arc/                 # Arc client, balance reader, and receipt log verifier
└── scripts/
    └── verify-arc-settlement.ts # Live onchain Arc settlement verification script
```

---

## Environment Configuration

Copy `.env.example` to `.env` and supply the required values:

```bash
# Server & Database Configuration
DATABASE_URL=postgres://user:password@127.0.0.1:5432/microcosm
PORT=3000

# Authentication (Privy)
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_server_secret
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id

# Arc Network Configuration
ARC_NETWORK=mainnet                    # 'mainnet' or 'testnet'
ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io/
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000

# Client Configuration
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

> **Security Note:** `ARC_SETTLEMENT_PRIVATE_KEY` is strictly prohibited on consumer transfer routes. Consumer payments require non-custodial client wallet signatures.

---

## Verification & Build Commands

All packages and apps are verified from the repository root:

```bash
# Clean install from lockfile
npm ci

# Typecheck all workspaces and packages (0 errors)
npm run typecheck

# Run full automated test suite (133/133 tests passing)
npm test

# Verify PostgreSQL migrations and apply schema
npm run db:apply-schema

# Verify API runtime health checks
npm run check:api-runtime

# Build Next.js responsive web application
npm run build --workspace=@mcosm/web

# Execute live Arc onchain settlement verification
node ./node_modules/tsx/dist/cli.mjs scripts/verify-arc-settlement.ts
```

---

## Release Gate Ledger (G0–G5)

| Gate | Focus Area | Status | Evidence Summary |
| :---: | :--- | :---: | :--- |
| **G0** | **Baseline & Repository** | **PASS** | Clean monorepo dependencies, zero-error typechecking, 133/133 tests passing, PostgreSQL concurrency & persistence tests verified. |
| **G1** | **Identity & Space Isolation** | **PASS** | Centralized `/v1` dispatcher, canonical principal resolution decoupled from email/wallet, multi-tenant Space isolation, viewer role read-only guards, single-use EIP-191 cryptographic wallet linking. Remediation completed through independent security code review. |
| **G2** | **Consumer Web UI** | **PASS** | Mobile-first and desktop-responsive web app in `apps/web`. Pure `BigInt` exact base units, Privy social login, `/money` (send flow), `/receive` (QR deposit address), `/people` (isolated contacts), `/activity` (verifiable receipt feed), `/settings`. Production Next.js build passes cleanly. |
| **G3** | **Live Arc Settlement Verification** | **PASS (Testnet) / AWAITING_MAINNET_TX** | Verified testnet transfer on Arc Testnet (chain `5042002`, block `67174208`, tx `0xb9ff68b7...21be408`) via `verifyUsdcTransfer`. Production mainnet transfer awaits user wallet signing approval. |
| **G4** | **Deployment & Verification Evidence** | **PASS** | Public HTTPS consumer app live on Vercel at `https://charcoal-brown.vercel.app`, GitHub repository public at `https://github.com/Jaydearcadian/Microcosm`. |
| **G5** | **Submission Pack & DoraHacks Handoff** | **PASS** | Formatted submission pack with project pitch, primitives breakdown, architecture diagrams, and copy-paste application form. |

---

## Known Limitations

- **Incoming Transfer Indexer:** v0.1 Activity feed records all user-authorized outgoing payments, pending transactions, and confirmed receipts. Direct incoming P2P transfer indexing requires an external indexer (e.g. Allium adapter) planned for v0.2.
- **Smart Contract Escrow:** Unreviewed `ClaimEscrow` and `SettlementRouter` contracts are disabled on consumer routes to avoid premature trust assumptions. Direct wallet-to-wallet ERC-20 transfers are the sole supported payment path in v0.1.
- **Multi-Chain Bridges:** Cross-chain bridge adapters remain experimental and outside the submission-critical Arc USDC path.
