# Microcosm Current Status

## 1. Purpose Of This Document

This document is the execution-state companion to the architecture, PRD, and implementation plans. It records the authoritative, verified status of the Microcosm codebase, deployed artifacts, infrastructure connectivity, and release gates.

---

## 2. Current Overall State

Microcosm v0.1 is implemented, tested, and deployed to production for the Arc Microgrants release:

- **Public Repository:** [`https://github.com/Jaydearcadian/Microcosm`](https://github.com/Jaydearcadian/Microcosm)
- **Live Production Deployment:** [`https://charcoal-brown.vercel.app`](https://charcoal-brown.vercel.app)
- **Architecture Model:** `Microcosm → Spaces → people/agents/money/rules → actions/settlement`
- **Identity Model:** Permanent canonical principal decoupled from external login providers (Privy, Google, email, wallet address).
- **Execution Model:** Non-custodial client wallet signing on consumer routes. Zero server settlement keys (`ARC_SETTLEMENT_PRIVATE_KEY` unset on public API).
- **Arc Settlement:** Fail-closed chain ID enforcement (`5042` Mainnet, `5042002` Testnet), official USDC address (`0x3600000000000000000000000000000000000000`), exact integer base-unit math (`BigInt`, 6 decimals), and independent onchain receipt verifier (`verifyUsdcTransfer`).

---

## 3. Verified Working State

The following items are verified with passing commands from the repository checkout:

- `npm run typecheck` passes (0 errors across monorepo root, API, worker, and packages)
- `npm run typecheck --workspace=@mcosm/web` passes (0 errors across Next.js app and route handlers)
- `npm test` passes (133 of 133 automated unit, integration, and security tests passing)
- `npm run build --workspace=@mcosm/web` passes (all static pages and dynamic serverless route handlers compiled)
- Next.js production web application live on Vercel at `https://charcoal-brown.vercel.app`
- Sensitive environment files excluded from Vercel deployments via `.vercelignore`
- Real Arc Testnet transaction executed and confirmed onchain (`0xb9ff68b720ccc128a8791435979dd08b50ea16d189df212a0e4a256b321be408`, block `67174208`)
- Arc Mainnet RPC (`https://rpc.mainnet.arc.io/`) verified returning chain ID `0x13b2` (`5042`)
- Arc Mainnet USDC contract (`0x3600000000000000000000000000000000000000`) verified onchain with `decimals() = 6` and `symbol() = USDC`
- PostgreSQL 16 schema, migrations, concurrency locks (`FOR UPDATE SKIP LOCKED`), and idempotency persistence verified

---

## 4. Release Gate Ledger (G0–G5)

| Gate | Focus Area | Status | Evidence Class | Verification Proof |
| :---: | :--- | :---: | :---: | :--- |
| **G0** | **Baseline & Repository** | **PASS** | `LOCAL_PASS` | Clean monorepo dependencies, zero-error typechecking, 133/133 tests passing, PostgreSQL concurrency & persistence tests verified. |
| **G1** | **Identity & Space Isolation** | **PASS** | `LOCAL_PASS` | Centralized `/v1` dispatcher, canonical principal resolution decoupled from email/wallet, multi-tenant Space isolation, viewer role read-only guards, single-use EIP-191 cryptographic wallet linking. Remediated through independent security code review. |
| **G2** | **Consumer Web UI & Live API** | **PASS** | `LIVE_READ_PASS` | Mobile-first and desktop-responsive web app in `apps/web`. Pure `BigInt` exact base units, Privy social login, `/money` (send flow), `/receive` (QR deposit address), `/people` (isolated contacts), `/activity` (verifiable receipt feed), `/settings`. Next.js API route handlers `/health`, `/readiness`, `/v1/*` deployed directly on Vercel. |
| **G3** | **Live Arc Settlement Verification** | **PASS (Testnet) / WAITING_ON_USER_WALLET_APPROVAL (Mainnet)** | `LIVE_WRITE_PASS` (Testnet) / `WAITING_ON_USER_WALLET_APPROVAL` (Mainnet) | Live transfer executed on Arc Testnet (chain `5042002`). Transfer verified via `verifyUsdcTransfer` checking ERC-20 `Transfer` topic (`0xddf25...`), verified contract `0x3600...0000`, sender, recipient, and base units. Mined in block `67174208`. Evidence recorded in `docs/ARC_SETTLEMENT.md`. Mainnet transfer awaits user wallet signing approval. |
| **G4** | **Deployment & Release Evidence** | **PASS** | `VERIFIED_REMOTE` | Public HTTPS consumer app and serverless API live on Vercel at `https://charcoal-brown.vercel.app`, GitHub repository public at `https://github.com/Jaydearcadian/Microcosm`. Sensitive environment files excluded from deployment bundle via `.vercelignore`. |
| **G5** | **Submission Pack & DoraHacks Handoff** | **DRAFT READY** | `VERIFIED_REMOTE` | Formatted submission pack complete with project pitch, primitives breakdown, architecture diagrams, and copy-paste application form in `docs/SUBMISSION_PACK.md`. Final interactive submission on DoraHacks awaits user button click. |

---

## 5. What Is Built in v0.1

### 5.1 Consumer Web Application (`apps/web`)
- Mobile-first responsive UI built with Next.js 15, React 19, and Tailwind CSS tokens.
- Five primary navigation routes: Home (`/`), Money (`/money`), People (`/people`), Activity (`/activity`), and Settings (`/settings`).
- Live Arc USDC balance reading directly via onchain RPC calls.
- Pure integer base-unit validation (`BigInt`, 6 decimals) with zero floating-point arithmetic.
- Non-custodial payment preparation and client wallet signing review modal.
- Native Next.js serverless route handlers for `/health`, `/readiness`, and `/v1/*` catch-all API dispatch.

### 5.2 Control Plane & API (`apps/api`)
- Centralized `/v1` route dispatcher with strict method validation (405 with Allow headers), payload size limits (413), and non-leaking 404s.
- Server-side Privy token verification with audience and expiry validation.
- Canonical principal resolution and personal Space provisioning.
- Scoped tenant isolation for recipients, envelopes, intents, payments, and audit logs.
- Removal of unsafe server-signed consumer execution.

### 5.3 Arc Settlement Engine (`packages/adapters/arc`)
- Fail-closed runtime configuration enforcing chain ID matching between config and remote `eth_chainId`.
- First-party Arc client supporting Arc Mainnet (`5042`) and Arc Testnet (`5042002`).
- Receipt verifier (`verifyUsdcTransfer`) auditing receipt status, ERC-20 `Transfer` topic, token contract address, sender, recipient, and amount base units.

### 5.4 Persistence & Concurrency (`packages/db`)
- PostgreSQL schema migrations with idempotent application.
- Entity models for spaces, memberships, users, recipients, envelopes, intents, payments, and settlements.
- Concurrency-safe worker queue with `FOR UPDATE SKIP LOCKED`.
- Scoped idempotency key persistence with payload collision detection.

---

## 6. What Is Deferred to Future Releases (v0.2+)

- **Incoming Transfer Indexer:** v0.1 records all user-authorized outgoing payments, pending transactions, and confirmed receipts. Direct incoming P2P transfer indexing requires an external indexer (e.g. Allium adapter) planned for v0.2.
- **Smart Contract Escrow:** Unreviewed `ClaimEscrow` and `SettlementRouter` contracts are disabled on consumer routes to avoid premature trust assumptions. Direct wallet-to-wallet ERC-20 transfers are the sole supported payment path in v0.1.
- **Multi-Chain Bridges & Cross-Chain Swaps:** Cross-chain bridge adapters remain experimental and outside the submission-critical Arc USDC path.
- **Automated Agent Orchestration:** Multi-agent autonomous treasury sweeps and scheduled payroll runs are planned for subsequent minor versions.

---

## 7. Submission Readiness Summary

The codebase, public repository, and live Vercel deployment are fully prepared for the Arc Microgrants submission deadline. All submission details, architecture diagrams, and copy-paste application form fields are consolidated in [`docs/SUBMISSION_PACK.md`](./SUBMISSION_PACK.md).
