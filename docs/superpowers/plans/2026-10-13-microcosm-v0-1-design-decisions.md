# Microcosm v0.1 Decisions and Deferred Work

This note prevents implementation agents from silently widening v0.1 or treating assumptions as verified facts.

## Fixed for v0.1

- Product name: Microcosm.
- Consumer mobile-first responsive web app, with extensible desktop layout.
- Persistent internal Microcosm ID distinct from Privy subject, email and wallet address.
- Personal Space created for every principal; Space is the root operating context for app resources.
- Privy is the first authentication/wallet integration, subject to real recovery and signing tests.
- PostgreSQL is durable application state.
- Arc mainnet USDC is the first live settlement route.
- Customer transfer is wallet-authorized; a server-held key does not sign it.
- A transfer is confirmed only from a matching onchain receipt and token event.
- The first release does not use current ClaimEscrow for email-based recipient claim.

## Must be verified before implementation commits

- Exact Privy React and server SDK methods and pinned compatible versions.
- Whether initial wallet is an embedded Privy wallet, an external wallet, or both. Prefer the smallest supported path that can pass identity recovery and signing acceptance.
- Official Arc mainnet ERC-20 USDC address and decimals at implementation time.
- Mainnet RPC health and `eth_chainId` behavior.
- Whether receipt polling should use public RPC only or a supplementary provider; primary source must be recorded.
- Production hosting, Postgres hosting and secret manager based on credentials actually available.

## Deferred from the critical path

- Email-to-wallet escrow and recipient claiming.
- Group/shared Spaces with multi-party spending authority.
- Autonomous agents and scheduled/recurring payments.
- Cross-chain identity execution, swaps, bridges or market integrations.
- XMTP messaging beyond an adapter seam; do not make messaging required for a successful transfer.
- Onchain purpose memo. Purpose can be local receipt metadata unless a suitable, verified mechanism is implemented safely.
- Full SDK and CLI.

## Kill / scope-reduction rules

- If provider login works but wallet recovery cannot be demonstrated, do not describe the wallet as recoverable. Ship only if the actual recovery model is made explicit and acceptable; otherwise the release gate fails.
- If mainnet address/configuration cannot be independently verified, do not submit a claimed mainnet build.
- If user-signed direct USDC transfer cannot be executed and verified before the deadline, do not replace it with simulated settlement and call the product live.
- If identity/API security is not complete, disable consequential payment mutations rather than expose an insecure public route.
