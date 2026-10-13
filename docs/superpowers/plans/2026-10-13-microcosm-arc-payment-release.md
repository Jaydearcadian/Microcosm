# Microcosm Arc Payment and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Follow TDD; no deployment or irreversible transaction until the exact action and environment are verified.

**Goal:** Safely complete the v0.1 user-authorized USDC payment lifecycle on Arc mainnet and produce independently verifiable deployment evidence.

**Architecture:** Separate read-only Arc network access from user-authorized transaction signing. The frontend/provider signs the exact prepared ERC-20 transfer. The API persists the authorized intent and submitted transaction hash, while a worker verifies chain ID, receipt status and the expected token `Transfer` event before projecting `confirmed`. Existing server-key settlement is disabled for consumer routes; existing escrow contracts remain out of scope until a separate security review passes.

**Tech Stack:** Existing `packages/adapters/arc`, `packages/settlement`, `packages/config`, viem, Privy React wallet API, PostgreSQL, current worker and tests; Arc mainnet RPC/explorer.

**Spec:** `docs/MICROCOSM_TECHNICAL_SPEC.md` §§4, 8, 11–14; `docs/MICROCOSM_PRD.md` §§7.3, 7.5–7.9, 9–10.

## Global Constraints

- Production only starts when `ARC_NETWORK=mainnet`, configured chain ID is `5042`, and the configured RPC returns that ID.
- Testnet only starts as an explicit non-production mode, chain ID `5042002`; no fallback to testnet on a mainnet misconfiguration.
- Verify the official mainnet USDC address and its ERC-20 interface/decimals from current Arc primary documentation at implementation time. Do not use a testnet address as evidence of mainnet support.
- Use decimal strings at API/UI boundaries and integer base units in transaction calls.
- Transaction submission uses the connected user's signing capability after explicit review. The backend cannot generate a second server-signed consumer transaction.
- `submitted` is not `confirmed`; confirmation requires successful receipt and an expected `Transfer` log matching token, sender, recipient and amount.
- Idempotency prevents repeat submission for the same prepared payment; receipt polling never resubmits.
- Do not deploy existing `ClaimEscrow` or `SettlementRouter` until reviewed and corrected. Do not expose raw email/lookup secrets onchain.


## Review Focus

1. Mainnet configuration paired with a testnet/mismatched RPC must fail readiness; covered in Task 1 tests.
2. Amounts with excess precision, exponent notation, negative signs or values beyond supported limits must be rejected without rounding; covered in Task 2 tests.
3. A prepared transaction whose recipient, amount, token, sender or chain changed after review must be rejected; covered in Task 3 tests.
4. A transaction hash with a wrong token, recipient, sender or amount must never become confirmed; covered in Task 5 tests.
5. Duplicate submission callbacks and worker retries must not initiate a second transfer or duplicate state transitions; covered in Tasks 4–5 tests.

## Task 1: Make Arc Runtime Explicit and Fail-Closed

**Files:** `packages/config/src/index.ts`, `packages/config/test/runtime-config.test.ts`, `apps/api/src/runtime.ts`, `apps/api/src/runtime.test.ts`, `apps/api/src/health.ts`, `packages/adapters/arc/src/index.ts`, `packages/adapters/arc/test/client.test.ts`.

- [ ] Add failing tests for missing mainnet RPC, invalid chain ID, network enum typos, production mainnet falling back to testnet, and invalid asset address.
- [ ] Extend config to return `{ network, chainId, rpcUrl, usdcAddress }`; require chain ID for selected environment and return the expected pair.
- [ ] Make Arc adapter construction accept explicit chain metadata and token address; remove reliance on hardcoded `ARC_CHAIN` for every environment.
- [ ] Startup/readiness calls `eth_chainId` and refuses ready if remote chain differs from the selected config.
- [ ] Update `.env.example`, docs and tests for distinct mainnet/testnet manifests. Do not add real private keys.
- [ ] Run config/API/adapter tests; commit.

## Task 2: Verify USDC Amount and Balance Adapter

**Files:** `packages/adapters/arc/src/index.ts`, `packages/adapters/arc/test/client.test.ts`, create or extend `packages/settlement/test/arc.test.ts`, shared money utility in `packages/api-contracts` or an appropriate domain package.

**Interface:** `parseTokenAmount(amount: string, decimals: number): bigint`; `formatTokenAmount(baseUnits: bigint, decimals: number): string`; `getUsdcBalance(address: Address): Promise<{ address: Address; chainId: 5042; baseUnits: string; decimals: 6; formatted: string; blockNumber: string }>`.

- [ ] Write tests for zero, positive amount, six fractional digits, excess precision, negative/NaN/exponent forms, leading/trailing whitespace, and very large integers.
- [ ] Implement string-to-base-unit conversion without JS floating-point arithmetic.
- [ ] Verify token address byte shape, `decimals()` and `balanceOf()` on the configured network; do not count native 18-decimal gas balance as a separate spendable token balance.
- [ ] Add simulated RPC tests for malformed return data, RPC failure and chain mismatch.
- [ ] Commit.

## Task 3: Prepare Immutable Payment Intents

**Files:** `packages/intents/src/index.ts`, `packages/intents/test/service.test.ts`, `packages/payments/src/index.ts`, `packages/payments/test/service.test.ts`, `apps/api/src/server.ts`, API contract package.

**Interface:** `POST /v1/payments/prepare` receives `{ intentId }` and returns a prepared object binding `paymentId`, `intentId`, `ownerUserId` (server only), `spaceId`, `chainId`, `tokenAddress`, `decimals`, `from`, `to`, `amountBaseUnits`, `amountDisplay`, `expiresAt`, `status: "prepared"`. Do not expose private owner IDs beyond the client contract.

- [ ] Test prepared transaction cannot be altered by changing recipient/amount/token/chain after review.
- [ ] Test expired, rejected, wrong-owner and policy-denied intents cannot be prepared.
- [ ] Test `from` is the authenticated user's configured wallet binding, not a body-supplied address.
- [ ] Implement deterministic server-side validation and persist prepared intent idempotently.
- [ ] Commit.

## Task 4: User-Authorized Wallet Submission

**Files:** `apps/web/features/money/SendForm.tsx`, `PaymentReview.tsx`, `PaymentProgress.tsx`, `apps/web/lib/wallet.ts` (or the chosen provider-specific module), `apps/api/src/server.ts`, payment tests.

- [ ] Verify the current Privy React API/version and viem integration method with installed types before implementation. The code path must be initiated only from an explicit user interaction.
- [ ] Test wallet not connected, wrong chain, user rejects signature, signing provider error, API timeout after tx submission and repeated submit click.
- [ ] Prepare the exact ERC-20 `transfer(to, amountBaseUnits)` call against the verified USDC contract on chain ID `5042`; display the same recipient, amount, token and network in the confirmation UI.
- [ ] After provider returns a transaction hash, POST `/v1/payments/:paymentId/submission` with the hash and idempotency key. Server rechecks ownership, prepared intent freshness and allowed state.
- [ ] Remove consumer use of API `/execute` paths that invoke server private-key settlement; make startup independent of `ARC_SETTLEMENT_PRIVATE_KEY` for user-signed transfer mode.
- [ ] Test request replay with same hash returns the original record; conflicting hash or conflicting idempotency payload is rejected.
- [ ] Commit.

## Task 5: Verify Onchain Receipt and Transfer Evidence

**Files:** `packages/adapters/arc/src/index.ts`, `packages/settlement/src/index.ts`, `packages/settlement/test/arc.test.ts`, `apps/worker/src/index.ts`, `apps/worker/src/index.test.ts`, `apps/api/src/payments-flow.test.ts`.

**Interface:** `verifyUsdcTransfer(input: { txHash: Hash; expectedChainId: 5042; tokenAddress: Address; from: Address; to: Address; amountBaseUnits: bigint }): Promise<{ status: "pending" | "confirmed" | "failed" | "mismatch"; blockNumber?: string; blockHash?: string; observedTransfer?: ...; reason?: string }>`.

- [ ] Test receipt missing/not indexed → pending, reverted receipt → failed, correct receipt/log → confirmed.
- [ ] Test wrong chain, wrong token, sender, recipient, amount, missing `Transfer` event, malformed receipt and RPC outage cannot become confirmed.
- [ ] Persist transaction hash before polling and use durable worker jobs with bounded retries/backoff and observable terminal/dead-letter errors.
- [ ] Make receipt polling idempotent; it never submits another transfer.
- [ ] Ensure API status transition is monotonic except an explicitly modelled reorg/reconciliation transition supported by evidence.
- [ ] Commit.

## Task 6: Close Existing Unsafe Execution Paths

**Files:** `packages/contracts/src/SettlementRouter.sol`, `packages/contracts/test/SettlementFlows.t.sol`, `packages/contracts/src/ClaimEscrow.sol`, `packages/adapters/arc/src/index.ts`, `apps/api/src/server.ts`, docs.

- [ ] Add regression tests demonstrating duplicate `paymentIdHash` is currently accepted by `SettlementRouter`; then implement a consumed-payment mapping and reject replay if the contract remains a future target.
- [ ] Add tests for private lookup-key leakage, owner-selected claim destination, double claim and missing expiry/refund. Do not deploy the existing escrow while any of these fail.
- [ ] For v0.1, disable/hide claim-escrow consumer routes and remove lookup key material from public chain interactions.
- [ ] Keep contract fix and deployment as a separate gated change; deploy only after external security review and dedicated Foundry tests pass.
- [ ] Run `npm run contracts:test` if Foundry is available, plus package tests; commit.

## Task 7: End-to-End Consumer Payment Acceptance

**Files:** add integration/browser coverage under `apps/web/tests/` and `apps/api/src/`, update `docs/MICROCOSM_STATUS.md`, `docs/MICROCOSM_IMPLEMENTATION_MATRIX.md` and deployment readiness evidence.

- [ ] Run E2E path using a dedicated test wallet and a small, explicitly approved amount: authenticate → wallet → balance → prepare → review → sign → submit → verify receipt → activity detail.
- [ ] Run negative path: user cancels signature; no submitted transaction or confirmed receipt appears.
- [ ] Run wrong-network path: UI blocks signing and server readiness fails closed if deployment config is mismatched.
- [ ] Run duplicate-submit and delayed-RPC paths; ensure one transaction and honest pending state.
- [ ] Independently open the tx hash in the Arc mainnet explorer and compare chain ID/network, contract, sender, recipient, amount, status and block details with the UI.
- [ ] Store non-secret evidence artifacts: timestamp, commit SHA, chain ID, tx hash, expected/observed transfer, verification command/result. Never store private keys or user secrets.
- [ ] Commit evidence and status update only after observing live behavior.

## Task 8: Deploy and Verify Release

**Files:** `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.env.example`, deployment docs and release evidence as discovered by local test.

- [ ] Verify container process binds to the intended interface (`0.0.0.0` inside the container) while local development can remain loopback-bound.
- [ ] Verify clean production build, secret management, database migration process, public health/readiness, HTTPS, CORS and correct browser API origin.
- [ ] Deploy frontend/API with `ARC_NETWORK=mainnet`, chain ID `5042`, verified RPC and USDC address, durable Postgres and no consumer server settlement private key.
- [ ] Run smoke tests against the public deployment, including signed-out denial and one read-only user journey.
- [ ] Execute one deliberately small live transfer only after reviewing the exact transaction in the wallet; independently verify explorer evidence.
- [ ] Produce public README steps, system architecture, deployed URL, repository URL and evidence references for the Arc Microgrants submission.

**Gate:** G3–G5 from the master plan pass. If live transfer verification fails, report the specific gate as blocked and do not substitute local mocks or a testnet hash.
