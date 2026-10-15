# Programmable envelopes (contract implementation)

## What is enforced onchain

`ProgrammableEnvelope` is a funded spending boundary for one ERC-20 token. Every outgoing payment checks, atomically onchain:

- caller is the owner or a configured operator;
- envelope is not paused;
- amount is positive and no greater than the per-transaction limit;
- an operator payment is no greater than the automatic-approval threshold. Larger payments require the owner to submit the payment transaction directly;
- recipient is allowlisted when allowlisting is enabled;
- current UTC weekday and hour fall inside the configured schedule;
- cumulative spend for the current UTC day remains within the daily cap;
- envelope has enough token balance.

The contract records spend before transferring tokens. A failed token transfer reverts the transaction, including the spend update. It uses six-decimal token base units for USDC. Weekday bits are Monday at bit 0 through Sunday at bit 6. The start hour is inclusive and end hour is exclusive. Overnight schedules are deliberately not supported in this first implementation.

`EnvelopeFactory` deploys one envelope per creator and records owner-to-envelope discovery. Each envelope has its own balance and policy. The owner can fund it, change policy, manage operators and recipients, pause execution, withdraw remaining funds, and transfer ownership.

## Trust boundary

This is programmable custody, not a trustless or immutable vault. The owner can change policy, pause execution, withdraw funds, and transfer ownership. An owner payment still cannot exceed the configured per-transaction or daily cap and cannot bypass schedule or recipient rules. Operators are constrained by the automatic-approval threshold.

The contract enforces deterministic fields only. It does not evaluate natural-language instructions, invoices, supplier quality, business context, or offchain agent reasoning. The API's policy evaluation is advisory unless the transaction is executed through the envelope contract. A direct USDC transfer outside an envelope bypasses these envelope policies by design.

## Deployment and verification

The deploy script expects `ARC_SETTLEMENT_DEPLOYER_PRIVATE_KEY` and `ARC_USDC_ADDRESS`. For Arc mainnet the expected USDC address is `0x3600000000000000000000000000000000000000`; verify it against current official Arc documentation before deployment. The example deployment JSON files intentionally contain zero contract addresses. Never replace them with predicted addresses or treat them as deployment evidence.

Run `forge test --root packages/contracts -vvv` before any deployment. Then deploy to Arc testnet first, verify chain ID and bytecode at each address, exercise factory creation, funding, allowed and rejected payments, daily cap, schedule, pause and withdrawal, and only then consider mainnet. This source has not received an independent security audit. Do not deploy it to mainnet with real funds without review.

## Claim escrow

`ClaimEscrow` is separate from an envelope. The depositor names a fixed recipient and expiry when creating an escrow. Only that recipient can claim before expiry; only the depositor can refund after expiry. A payment ID cannot be reused, and no email/lookup key is written onchain. This contract is not currently wired into the app's send flow.
