# Microcosm contract implementation status

## Implemented in this patch

- `ProgrammableEnvelope.sol`: funded, per-envelope USDC balance; authorized operators; per-transaction cap; UTC daily cap; weekday/hour schedule; optional recipient allowlist; operator automatic-approval threshold; pause switch; owner policy administration; payment-ID replay protection; event receipts; non-reentrant token interactions.
- `EnvelopeFactory.sol`: deploys one independently owned envelope per creator and exposes envelope discovery by owner.
- `ClaimEscrow.sol`: recipient-bound claims and depositor refunds after expiry. No email or lookup key is stored onchain. Claim/refund are mutually exclusive and replay-protected.
- `DeployArcContracts.s.sol`: deploys the router, updated escrow, and envelope factory, using `ARC_USDC_ADDRESS`.
- Foundry tests for envelope policy enforcement, factory ownership, direct router compatibility, recipient-only escrow claims, replay prevention, and expiry refunds.

## Verification performed

- Foundry test suite passed in an isolated Vercel sandbox using the repository source at `c9a3d76342756d7d8e479b7a7d95bc5e5a9671bd` plus this patch: **15 passed, 0 failed**.
- Solidity compilation completed successfully as part of `forge test` with optimizer and IR compilation enabled.
- The tests covered operator authorization, automatic approval threshold, per-transaction and UTC daily caps, UTC weekday/hour restrictions, allowlisted recipients, pause/unpause, owner withdrawal, duplicate payment ID rejection, factory-created ownership, escrow recipient restriction, single claim, and expiry refund.

## Not yet verified or completed

- No contracts have been deployed by this patch. Example deployment manifests deliberately retain zero addresses until a real deployment receipt and explorer verification are available.
- The existing web app's `PaymentReview` flow still prepares and sends a direct USDC transfer. It is **not yet wired to create, fund, select, or execute through `ProgrammableEnvelope`**. Therefore the deployed app will not enforce these contract rules until that integration and deployment are completed.
- The deployment script itself was updated but was not independently run against a chain; `forge build --root packages/contracts --sizes` and a testnet deployment remain to be run after applying this patch.
- These contracts have not received an independent security audit. Do not use mainnet funds before a review and testnet rehearsal.

## Trust model

The envelope is not an immutable trustless vault. The owner can change policy, pause, withdraw remaining funds, and transfer ownership. Owner-initiated payments still obey the configured transaction cap, daily cap, schedule, and recipient rules. Operators additionally obey the automatic-approval threshold. Direct transfers made outside an envelope bypass envelope rules.

## Apply

Extract `microcosm-contract-implementation.zip` at the repository root, preserving the `packages/contracts/...` paths. Review the diff before committing. Run:

```sh
forge test --root packages/contracts -vvv
forge build --root packages/contracts --sizes
```

## Repo integration verification (this workspace, after applying the patch)

### Contract verification

- `forge test --root packages/contracts`: **15 passed, 0 failed** (3 suites).
- **Correction to the ledger above:** as delivered, the patch reproduced as **14/15**. `testDepositorCanRefundAfterExpiry` asserted `960 * UNIT` after a successful refund, but the trace shows the refund correctly returning `40 UNIT` to a depositor who started with `1000 UNIT` — the expectation itself was wrong. Fixed the assertion to `1000 * UNIT`; contract behavior was correct.
- `forge build --root packages/contracts --sizes`: largest deployable contract is `EnvelopeFactory` at **8,221 B** runtime (16,355 B margin to EIP-170's 24,576 B limit); `ProgrammableEnvelope` 5,138 B; `ClaimEscrow` 2,718 B; `SettlementRouter` 760 B. All pass with `optimizer = true`, `optimizer_runs = 200`, `via_ir = true`.
- One non-blocking `forge-lint` advisory remains on `ProgrammableEnvelope.sol:198` (`unsafe-typecast` of `1 << utcDayIndex` to `uint8`): provably safe because `utcDayIndex` is `(block.timestamp / 1 days + 3) % 7`, i.e. always `0..6`.

### Application handshake (completed)

- **Intent type:** `CreateIntentInput.envelopeAddress?: string` added in `packages/intents`.
- **Preparation:** `/v1/payments/prepare` now branches — when the intent carries `envelopeAddress`, it returns `executePayment(bytes32,address,uint256)` calldata (`selector 0xa97274c2`) targeting the envelope with `execution: "envelope"`; otherwise it falls through to the legacy direct USDC transfer with `execution: "direct"`. Encoding is fail-closed: unparsable base units return `400 invalid_amount_base_units`.
- **Shared encoder:** `encodeEnvelopeExecutePayment` + `paymentIdHash` exported from `@mcosm/adapter-arc`, used by the API, and verified byte-for-byte against viem's `encodeFunctionData` (independent ABI oracle).
- **Adapter:** `claimEscrowAbi` retargeted to the new recipient-bound escrow (`createEscrow(paymentIdHash, token, recipient, amount, expiresAt)`, `claim(paymentIdHash)`, `refund(paymentIdHash)`, `EscrowRefunded`); added `refundEscrow`, `executeEnvelopePayment`, `createEnvelope` + `envelopeFactoryAbi`, and `ENVELOPE_CREATED_TOPIC`.
- **Contracts schema:** `PreparePaymentResponse` gained optional `execution` / `envelopeAddress`; legacy responses stay valid.
- **UI:** `PaymentReview` displays the prepared route (envelope address + "Programmable Envelope (onchain policy)" vs "Direct USDC transfer"). Signing remains entirely client-side — no server key ever touches envelope deployment or execution.
- **Monorepo gates:** 137/137 tests pass (3 new: viem encoder oracle, factory write shape, envelope schema mode); `tsc --noEmit` clean at root and in `apps/web`.

### Still outstanding

- No on-chain deployment has occurred. `deployments/arc-*.example.json` keep zero addresses by design; populate `arc-testnet.json` only from a verified broadcast receipt (§C above).
- The EnvelopeVault UI is not yet wired to `createEnvelope` — the adapter method exists and is tested, but activation requires the deployed factory address from the testnet manifest.
- Not audited. Do not use mainnet funds before review and testnet rehearsal.

