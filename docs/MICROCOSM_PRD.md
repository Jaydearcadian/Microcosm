# Microcosm Product Requirements Document

**Product:** Microcosm  
**Document:** Product Requirements Document (PRD)  
**Version:** 0.1.0  
**Status:** Proposed build baseline, pending implementation verification  
**Prepared:** 2026-10-13  
**Initial deployment target:** Arc mainnet  
**Primary audience:** Consumers who want to use digital money without making blockchain accounts, wallet addresses, and transaction mechanics the centre of the experience

---

## 1. Executive decision

Build **Microcosm**, a mobile-first, identity-native financial home. Do not reduce the product to a standalone send-USDC form. The consumer app is the first usable surface of a broader system that coordinates identity, people, money, rules, actions, and settlement.

The initial release must feel like a complete product: users can create and recover a Microcosm identity, access a wallet, see their Arc USDC balance, send and receive USDC, manage supported recipients, and inspect verified transaction history. The app must have a responsive desktop layout using the same application and domain model.

The release is intentionally bounded in what it executes. Shared treasury, multi-party pooled money, autonomous-agent spending, email-based escrow, cross-chain movement, and a marketplace may be represented as future product directions, but must not be presented as live capabilities until the implementation and security evidence exists.

### Product thesis

People should interact with money through a persistent identity and understandable intent, not through raw addresses and chain mechanics as the primary interface. Microcosm provides the identity and coordination layer; wallets authorize execution; Arc is the first settlement environment.

### Product model

Canonical language:

**Microcosm → Spaces → people, agents, money, rules → actions and settlement.**

A **Space** is the bounded operating environment in which actors, payment capabilities, rules, counterparties, activity, and settlement are coordinated. The initial consumer release creates one personal Space per user. The data model should support shared Spaces later without making shared funds a launch requirement.

---

## 2. Problem and opportunity

### 2.1 User problem

Current crypto payment experiences often require users to understand wallet addresses, network selection, token balances, signatures, transaction confirmation, and recovery as separate technical problems. A wallet can provide keys and signing, but it does not by itself provide a persistent application identity, recipient semantics, payment-intent lifecycle, user-facing policy checks, or a recoverable relationship model.

Microcosm should make routine financial actions feel familiar while preserving the actual authority and settlement boundaries underneath.

### 2.2 Product opportunity

Combine:

- identity abstraction and recovery;
- wallet provisioning or wallet connection;
- recipient resolution and saved people;
- structured payment intents and pre-send validation;
- real USDC settlement on Arc;
- verified activity and shareable receipts;
- an extensible Space model for future rules, shared financial relationships, and agents.

This combination is the product. A transfer screen is only the first live financial action that demonstrates it.

### 2.3 Product hypotheses to validate

1. Consumers value a stable identity and recoverable access more than direct exposure to wallet management.
2. A recognizable recipient identity and a clear review screen reduce payment mistakes compared with copying raw addresses.
3. A reliable receipt linked to actual chain evidence is more useful than a generic “success” screen.
4. A Space-based model can support future personal, shared, and agent-assisted financial workflows without forcing users to understand protocol abstractions on day one.

These are hypotheses, not validated research findings. Product polish or a working demo alone does not validate demand.

---

## 3. Goals and non-goals

### 3.1 Goals for the initial release

- Provide a coherent mobile-first consumer app with an extensible desktop layout.
- Create a persistent Microcosm principal and personal Space during onboarding.
- Support authentication and a clearly described recovery path.
- Provision or connect a wallet that can transact on Arc mainnet.
- Display an observed USDC balance through Arc’s documented ERC-20 interface, without confusing the ERC-20 amount representation with the native 18-decimal gas representation.
- Allow a user to review and explicitly authorize a direct USDC transfer.
- Support receiving USDC through a wallet address and QR/link presentation.
- Store saved recipients and display recipient labels separately from verified wallet addresses.
- Maintain a durable payment lifecycle and show receipts based on real transaction data.
- Keep the backend API and domain services composable for future clients.
- Build security and truthful-state behavior into the core, not as post-demo cleanup.

### 3.2 Non-goals for the initial release

- General-purpose multi-chain wallet.
- A custodial omnibus wallet or server-held user funds.
- Server-side autonomous execution using one shared private key.
- Smart-contract account abstraction unless it is needed, tested, and supportable within the release scope.
- Email-recipient escrow until the claim, privacy, authorization, expiry, and refund model is redesigned and audited.
- Cross-chain bridge execution.
- Agent-initiated payments without a separate, explicit mandate and enforcement model.
- Shared pots, group savings, lending, swaps, yield, prediction markets, or an app marketplace as launch-critical features.
- Onchain publication of email addresses, phone numbers, or other personal identity attributes.
- Claims of confidentiality, self-custody, or automatic recovery that do not match the selected provider and wallet configuration.

### 3.3 Product principle

**Build the full application shell and identity model; limit launch-critical live money movement to the capabilities that can be verified safely.**

---

## 4. Users and jobs to be done

### 4.1 Primary user: consumer

A person who wants a simple, trustworthy way to hold and send USDC without needing to understand every underlying component.

**Jobs to be done**

- “Help me get started without making me manage a seed phrase as my first task.”
- “Let me regain access to the same identity if I lose a session or change devices.”
- “Let me send money to the right person and check the details before I approve.”
- “Show whether the payment is actually confirmed, not merely submitted.”
- “Give me a receipt I can inspect or share without exposing unnecessary private information.”

### 4.2 Secondary user: recipient

A person receiving USDC from a Microcosm user.

**Jobs to be done**

- Know where a payment was sent and whether it confirmed.
- Receive funds to a verified wallet address.
- Eventually, claim a payment through a recoverable Microcosm identity when recipient claiming is implemented safely.

### 4.3 Future user: shared-Space owner

A person coordinating payments with a household, group, club, event, or small organization. This user needs roles, contribution visibility, spending limits, approvals, and recovery rules. Shared money is not required for the initial launch, but the Space model must not prevent it.

### 4.4 Future user: agent operator

A user or organization delegating narrowly scoped payment actions to an agent. Identity must remain distinct from authority. Agent execution is out of scope until mandates, budgets, expiry, replay protection, approval, revocation, and auditability are enforced.

---

## 5. Product principles and invariants

1. **Identity is not authentication.** The Microcosm principal persists across authentication-method changes.
2. **Identity is not a wallet.** A user may have one or more wallet bindings without changing their Microcosm identity.
3. **Authentication recovery is not automatically wallet recovery.** The app must identify what the provider can recover and demonstrate it through tests.
4. **A wallet connection is not proof of recipient identity.** Store verified associations separately from user-entered labels.
5. **Intent is not execution.** Creating or approving a payment intent does not mean a transaction was submitted or settled.
6. **Submitted is not confirmed.** Only observed chain evidence may produce the confirmed state.
7. **Application policy is not onchain enforcement.** The UI must not imply that client-side checks are immutable or impossible to bypass.
8. **The user authorizes the exact payment.** The initial user payment flow is signed by the user's wallet. The API cannot silently sign ordinary consumer payments with a shared server key.
9. **No private identity attributes onchain by default.** Do not publish an email address or other personal identifier in contract parameters or transaction calldata.
10. **No silent fallback to simulation.** If real execution is unavailable, disable or explicitly label the operation as unavailable. Never show simulated settlement as real.
11. **The Space is the bounded operating context.** Users, wallet bindings, counterparties, rules, and actions are scoped to a Space when that distinction is relevant.
12. **Composable interfaces, one domain model.** The mobile web app, desktop layout, SDK, CLI, and future agent tools must call the same domain services and API contracts.

---

## 6. Information architecture

### 6.1 Navigation

Mobile uses bottom navigation for the principal areas and full-screen focused flows for consequential actions. Desktop uses a persistent sidebar and wider page layouts. Do not fork the product into separate mobile and desktop implementations.

| Area | Purpose | Launch behavior |
|---|---|---|
| Home | Personal Space overview, balance, quick actions, recent activity | Live balance and live payment records only |
| Money | Send, receive, and payment details | Direct USDC send and receive on Arc |
| People | Saved recipients and verified address associations | Save, edit label, resolve supported recipient types |
| Activity | Payment lifecycle and receipts | Backed by stored records and chain verification |
| Space | Name, owner, members/roles placeholder for future shared Spaces | One active personal Space at launch; no fake members or controls |
| Settings | Profile, linked authentication methods, wallet, network, security, recovery | Actual provider state and supported actions only |

### 6.2 Main screens

#### A. Public entry and onboarding

- Explain Microcosm in plain language.
- Offer supported login methods configured in Privy.
- Explain that a Microcosm identity and wallet are related but distinct.
- After authentication, synchronize the verified provider principal to the Microcosm user record.
- Create or load the user's personal Space idempotently.
- Provision or connect an EVM wallet capable of using Arc.
- Explain the wallet control/recovery model before the user begins holding or transferring funds.
- Do not ask the user to paste or upload a seed phrase into Microcosm.

#### B. Home

- Active Space identity and display name.
- Available USDC balance with network clearly identified as Arc mainnet.
- Primary actions: Send, Receive.
- Recent activity with status labels derived from the persisted payment and chain state.
- Empty state for a new user, with no fabricated activity or sample balances presented as real.
- Useful failure states: wallet missing, network mismatch, balance unavailable, RPC degraded, no activity.

#### C. Money / Send

1. Choose or enter recipient.
2. Resolve identity to a known wallet address, or clearly use a directly supplied address.
3. Enter amount in USDC using decimal-safe validation.
4. Show sender wallet, recipient label and full/copyable address, amount, token, network, and estimated fee if it can be estimated reliably.
5. Run app-level validations and any applicable envelope checks.
6. Require explicit user confirmation.
7. Request wallet signature for the exact transaction.
8. Record the transaction hash immediately after wallet submission.
9. Verify the receipt and token transfer from Arc RPC.
10. Display pending, confirmed, or failed state accurately.

The confirmation screen must show enough address detail to avoid ambiguity. Contact labels are not security identities.

#### D. Money / Receive

- Display the user's Arc wallet address and QR code.
- Provide copy and share actions.
- Clearly state the network and asset expected.
- Do not imply that a payment has arrived until the balance/indexer or RPC-backed activity has observed it.
- Avoid displaying sensitive personal data inside the QR code or shareable payload.

#### E. People

- Saved recipient list with display label and address verification state.
- Add recipient by supported Microcosm identity or wallet address.
- Show the address and chain before first payment to a recipient.
- Permit a user label, but label it as user-created metadata rather than a verified identity claim.
- Prevent arbitrary public lookups by email or handle from leaking whether a person has a Microcosm account.
- Unknown email claiming remains disabled until an expiring, high-entropy, single-use claim flow with privacy-safe onchain semantics and a refund path exists.

#### F. Activity and payment detail

- List payments sorted newest first.
- Filter by sent/received and status where the data model supports this truthfully.
- Detail view includes recipient, sender, token, amount, network, created time, submission time, transaction hash, block number, status, and explorer link.
- Store the purpose as application metadata unless it has been separately encoded in a verified onchain mechanism.
- Distinguish `Created`, `Needs approval`, `Awaiting signature`, `Submitted`, `Confirming`, `Confirmed`, `Failed`, `Cancelled`, and `Needs reconciliation`.
- Retry must not duplicate an already-submitted transfer.

#### G. Settings / Identity and recovery

- Show Microcosm ID and linked login methods.
- Show wallet address and wallet provider state.
- Let users add/remove authentication methods only through supported provider flows.
- Explain session logout versus permanent identity deletion.
- Explain account recovery and wallet recovery separately.
- Show network/environment explicitly.
- Provide a security activity and session-management surface if supported by the provider integration.
- Do not imply that deleting a login identity reverses onchain transactions or deletes public chain history.

#### H. Space

- Every new consumer gets a `personal` Space.
- The Space is the default context for personal wallet bindings, saved people, activity, and rules.
- v0.1 does not need a Space directory, public discovery, shared treasury or multi-member authorization.
- Data structures must make owner, member/role, and rule scope explicit so shared Spaces can be introduced without reinterpreting personal Space records.

---

## 7. Functional requirements

Priority definitions: **P0** required for the first release; **P1** should follow immediately after the safe first release; **P2** future capability.

### 7.1 Identity and account lifecycle

- **ID-001 (P0):** A user can authenticate using one or more login methods enabled in Privy.
- **ID-002 (P0):** The backend verifies the authentication token using the server-side provider SDK; it does not trust a client-supplied provider user ID alone.
- **ID-003 (P0):** Microcosm creates or loads exactly one stable internal principal for a verified provider principal.
- **ID-004 (P0):** Repeated onboarding calls are idempotent and do not create duplicate users or personal Spaces.
- **ID-005 (P0):** A user may link another supported login method without replacing the internal Microcosm ID.
- **ID-006 (P0):** A wallet binding is stored separately from login identifiers and may be updated only after a verified provider/wallet operation.
- **ID-007 (P0):** User-owned records are isolated by authenticated principal and active Space. A client cannot read or mutate another user's payment, recipient, or identity records by guessing IDs.
- **ID-008 (P0):** The interface and help text describe the exact supported account and wallet recovery behavior.
- **ID-009 (P0):** Recovery testing verifies access continuity across a clean browser session and second device/session; wallet control is separately verified.
- **ID-010 (P1):** Account deletion/export and retention policy, including the effect of public blockchain records, are implemented and documented.

### 7.2 Space lifecycle

- **SP-001 (P0):** Every user has one personal Space.
- **SP-002 (P0):** Core records reference their owner and, where applicable, a Space ID.
- **SP-003 (P0):** The API authorizes Space access server-side.
- **SP-004 (P1):** Shared Spaces support membership and explicit roles such as owner, operator, and viewer.
- **SP-005 (P2):** Shared Spaces support multi-party spending controls, contributions, and scoped service/agent actors.

### 7.3 Wallet and balance

- **WL-001 (P0):** A user can provision or connect an EVM wallet through a supported Privy flow.
- **WL-002 (P0):** Wallet/network state is shown honestly. The app detects a wrong chain and requests a switch where supported.
- **WL-003 (P0):** Balances are read from Arc mainnet for the configured USDC contract, using a verified contract address from official network/token information.
- **WL-004 (P0):** The UI handles zero balance, unavailable RPC, stale read, wallet absence, and wrong network distinctly.
- **WL-005 (P0):** User-directed USDC transfer transactions are signed through the user's wallet/provider path, not a shared API private key.
- **WL-006 (P0):** User funds remain in the user's wallet for direct sends; the first release does not require depositing to a Microcosm-controlled contract.
- **WL-007 (P1):** Additional external wallet options are supported after testing ownership, chain compatibility, and signing UX.

### 7.4 Recipient resolution and People

- **RC-001 (P0):** A recipient can be represented by a stable internal ID, display label, claimed/unclaimed state, and zero or more verified address associations.
- **RC-002 (P0):** An explicitly entered wallet address is validated for the target chain and shown before signing.
- **RC-003 (P0):** Saved recipients are scoped to their owner/Space.
- **RC-004 (P0):** A user-created contact label is visibly distinct from provider-verified identity or wallet-control evidence.
- **RC-005 (P0):** Recipient resolution errors are actionable and do not silently fall back to an unrelated address.
- **RC-006 (P1):** Private handle/email-based recipient resolution includes abuse controls, consent, non-enumerability, and explicit proof of recipient association.
- **RC-007 (P2):** Unknown recipient claim is available only when claim authorization, privacy, expiry, refund, and onchain contracts meet the dedicated safety gate.

### 7.5 Payment intent and policy

- **PM-001 (P0):** A send attempt is represented as a typed payment intent with sender, recipient, asset, decimal amount, chain, purpose metadata, applicable rules, and expiry.
- **PM-002 (P0):** The app validates amount, address, asset, chain, spendable balance, and applicable policy before invoking wallet signing.
- **PM-003 (P0):** The UI displays the exact transaction target and amount that the wallet will authorize.
- **PM-004 (P0):** Rejected/expired intents cannot be submitted from a stale confirmation screen.
- **PM-005 (P0):** The intent snapshot stores which policy/envelope version was evaluated at the time of review.
- **PM-006 (P0):** Client-side policy results are not treated as security boundaries. Server-side validations repeat all relevant checks before the client receives a prepared transaction.
- **PM-007 (P1):** User-configured payment envelopes support per-transaction limits, per-period limits, allowed recipients, and schedules with an explicit timezone.
- **PM-008 (P2):** Agent-issued intents require a mandate, budget, target/chain and asset scopes, expiry, nonce/replay controls, policy version, and revocation semantics. Not in launch scope.

### 7.6 Send and settlement

- **ST-001 (P0):** A payment cannot be marked `submitted` until an actual transaction hash is observed from the wallet/provider flow.
- **ST-002 (P0):** A payment cannot be marked `confirmed` based solely on the wallet returning a hash.
- **ST-003 (P0):** A chain receipt and expected token transfer are verified from Arc RPC or an independently specified trusted read provider.
- **ST-004 (P0):** Transaction hash and chain ID are unique for a recorded chain execution; repeated callbacks do not create duplicate payment records.
- **ST-005 (P0):** Network/RPC ambiguity becomes `needs_reconciliation` or remains `confirming`, not false success.
- **ST-006 (P0):** Retry logic first checks whether a transaction was already submitted or mined. It never blindly submits the same payment again.
- **ST-007 (P0):** The application has a durable confirmation/reconciliation worker with bounded exponential backoff, attempt caps, and a dead-letter/alert path.
- **ST-008 (P0):** The target network is selected explicitly. A production environment must not silently default to testnet.
- **ST-009 (P1):** An onchain memo or custom contract event can bind a purpose digest to a transfer only after the relevant mainnet integration has been independently tested. Purpose stays offchain otherwise.
- **ST-010 (P2):** Contract-based escrow, refunds, recurring payments and conditional settlement require dedicated contract threat models and formal negative-path tests.

### 7.7 Receive

- **RE-001 (P0):** The app exposes the user's verified Arc wallet address and a QR representation that resolves to that address and network.
- **RE-002 (P0):** Copy and share actions do not include private auth identifiers or credentials.
- **RE-003 (P0):** Receiving state reflects chain evidence; the app does not infer payment solely from a sender's screenshot or message.
- **RE-004 (P1):** Generate a shareable request URL that includes only the data needed to request payment and cannot authorize a payment.

### 7.8 Activity, audit and receipts

- **AC-001 (P0):** Every consequential payment lifecycle transition emits an append-only audit event with actor, timestamp, object, and evidence reference.
- **AC-002 (P0):** The user sees only the records they are authorized to access.
- **AC-003 (P0):** Payment detail displays chain, transaction hash, status, amount, sender, recipient, timestamps, and an explorer link.
- **AC-004 (P0):** The receipt distinguishes chain facts from application metadata and provider assertions.
- **AC-005 (P0):** Activity survives API/worker restart and can be reconstructed from durable state plus chain evidence.
- **AC-006 (P1):** Users can export or share a privacy-safe receipt.

### 7.9 Notifications

- **NT-001 (P0):** In-app notifications may report payment state only when that state is derived from the payment lifecycle.
- **NT-002 (P1):** Email/push/XMTP notifications use retryable delivery jobs and never become the source of truth for whether settlement occurred.
- **NT-003 (P2):** XMTP-based wallet-native messaging and payment requests are added as a separate adapter after the consumer send/receive lifecycle is stable.

---

## 8. UX and visual design requirements

- Mobile-first, responsive layout with a target minimum viewport of 360 CSS px.
- Desktop layout progressively expands into a sidebar/navigation shell and larger content region.
- Avoid a desktop dashboard squeezed into a mobile viewport.
- Use short, recognizable product language. Keep protocol terms such as Space, envelope, intent, settlement, and mandate out of primary consumer copy unless an explanation is available.
- Visual hierarchy should prioritize available balance, primary action, recipient, amount, and payment state.
- Use unambiguous status words: `Awaiting signature`, `Submitted`, `Confirming`, `Confirmed`, `Failed`, `Needs reconciliation`.
- Do not rely only on color to communicate payment state.
- Destructive or consequential actions require clear review and an explicit final approval step.
- Loading, empty, offline, degraded, stale-data, transaction-pending, transaction-reverted, and recovery-failure states must be designed, not left to generic toast messages.
- Accessibility: keyboard navigation on desktop, visible focus, semantic labels, sufficient contrast, accessible QR alternatives, and reduced-motion support.
- Do not expose a fake balance, sample transaction or seeded contact as real user information.

---

## 9. Security, privacy, and trust requirements

### 9.1 Identity and authentication

- Verify provider tokens on the server; client-submitted `privyUserId` or wallet address is not sufficient proof of identity.
- Use provider subject IDs as external identity references and a stable, internal Microcosm ID as the product principal.
- Enforce uniqueness and account-linking rules transactionally to prevent identity collision or account takeover.
- Do not merge accounts solely because email strings match. Require an authenticated linking or recovery proof.

### 9.2 Wallet authority

- No consumer transfer is signed by a shared server-held private key.
- No seed phrase or private key is collected by Microcosm.
- Wallet-provider authorization must include the precise target, chain, token/contract, amount, and call data.
- If server-side signing is ever added for agents or services, it must use a separate key/mandate boundary with strict spending scope, per-action budgets, expiry, revocation, monitoring, and separate security approval.

### 9.3 PII and chain privacy

- Do not send raw email, phone, or identity attributes to smart-contract events or transaction calldata.
- Normalize and protect private lookup attributes; unsalted public hashes are not sufficient protection for predictable values such as emails.
- Avoid public account enumeration through recipient-resolution endpoints.
- Receipt sharing must let users choose which application metadata to include.

### 9.4 API and persistence

- All user-specific API routes require verified authentication and server-side ownership checks.
- Require idempotency keys for payment-intent creation and other consequential mutations.
- Rate-limit authentication, recipient lookup, claim/invite, and payment preparation routes.
- Validate all request bodies against versioned schemas.
- Use parameterized SQL and transactional uniqueness constraints.
- Encrypt secrets in managed secret storage. Do not commit `.env`, RPC keys, Privy secrets or wallet keys.
- Use restrictive CORS, secure cookies or short-lived bearer tokens as appropriate, CSRF protection where cookies are used, CSP, and security headers.
- Audit logging must not leak bearer tokens, private keys, full PII or reusable claim secrets.

### 9.5 Contract restrictions

The current `ClaimEscrow` stores a raw `lookupKey`, exposes it through an event, and permits only the contract owner to call `claim()` with a recipient address chosen by that owner. It also lacks an expiry/refund lifecycle. It must not be deployed unchanged for consumer claimable payments.

The current `SettlementRouter.settleDirect()` has no consumed-payment-ID mapping, so replay prevention cannot be inferred from its computed settlement ID. Do not use it as a replay-safe payment authority without a reviewed contract change and tests.

---

## 10. Success metrics and release gates

### 10.1 Functional success metrics

- Onboarding success: authenticated user receives one persistent Microcosm identity and one personal Space.
- Recovery success: a user can recover access in a clean session without creating a duplicate principal or losing the intended wallet binding.
- Payment completion: the user can execute one real USDC transfer on Arc mainnet end-to-end.
- Receipt correctness: the displayed hash, sender, recipient, amount, token and confirmation state match independent onchain evidence.
- State reliability: restart/retry does not lose or duplicate a payment record.
- Security failures: unauthorized reads/writes are rejected; invalid or stale intents cannot produce a wallet prompt.

### 10.2 Suggested targets for internal acceptance

- 100% of release-critical acceptance scenarios pass.
- 0 false `confirmed` states in test vectors and manual mainnet smoke tests.
- 0 duplicate payment records under repeated requests with the same idempotency key.
- 0 unauthenticated access to user-private records.
- 100% of transfers in the demo can be independently opened in the Arc explorer.
- Recovery test covers a clean browser session and a separate device/session where feasible.

These are release gates, not claims about existing measured production performance.

### 10.3 Grant submission gate

- Public repository containing reproducible setup and current evidence.
- Publicly accessible web deployment.
- Live Arc mainnet transaction path, not a testnet-only build.
- At least one independently verifiable successful transaction generated from the deployed app.
- Clear statement of what is live, what is simulated, and what remains out of scope.
- Public builder profile and submission links as required by the program.

---

## 11. Delivery plan

### Phase 0: Stabilize and establish ground truth

- Clean install from `package.json` and lockfile on a clean machine.
- Run typecheck and all existing tests.
- Establish one implementation/status ledger.
- Verify exact Privy client/server APIs and chosen recovery configuration.
- Confirm official Arc mainnet chain configuration and USDC contract address from authoritative sources.
- Remove misleading testnet defaults from production configuration.

**Exit:** reproducible local build, clearly enumerated blockers, explicit network settings.

### Phase 1: Consumer app foundation

- Add `apps/web` with responsive app shell.
- Implement authentication, session state, `GET /v1/me`, and identity synchronization.
- Create/load personal Space idempotently.
- Connect/provision wallet and display address/network.
- Build Home, Money, People, Activity and Settings routes with real states and empty/error states.

**Exit:** user can onboard and navigate the app; no payment is represented as successful by mock behavior.

### Phase 2: Real Arc send/receive

- Add browser wallet transaction path using the selected Privy wallet APIs.
- Read balance from the verified Arc USDC contract.
- Implement send review, exact wallet authorization, tx-hash persistence and receipt reconciliation.
- Implement receive address and QR.
- Enforce authenticated server-side ownership and idempotency.

**Exit:** one deployed user can make a real mainnet transfer; transaction detail independently matches chain evidence.

### Phase 3: Hardening and grant proof

- Run recovery, authorization, invalid-recipient, invalid-amount, low-balance, wrong-chain, pending, reverted, RPC-failure and retry tests.
- Harden worker lease/backoff/dead-letter behavior.
- Validate Docker and production bind/health checks.
- Deploy, run smoke tests, capture evidence and update documentation.

**Exit:** release checklist and public evidence bundle are complete.

### Phase 4: Post-submission expansion

- Safe claimable-recipient flow.
- Payment requests and reminders.
- Shared Spaces and role-based authority.
- User-configurable envelopes.
- XMTP notifications and contact messaging.
- Agent mandate and controlled execution surfaces.
- Additional chain adapters only after Arc lifecycle is reliable.

---

## 12. Risks, assumptions, and open decisions

### Material risks

- The available time may be insufficient to complete verified wallet recovery, account linking, mainnet settlement, operational hardening, and public deployment simultaneously.
- Privy authentication recovery may not equal recovery of the selected wallet control configuration; the exact behavior must be tested.
- RPC or indexer lag can delay the display of settled transactions.
- Identity-based recipient resolution can create privacy and enumeration risks.
- Current onchain escrow contracts are not safe enough to ship unchanged.
- The current backend HTTP surface lacks production-grade authentication/authorization at the server boundary.
- Current network configuration can default to testnet and must be made explicit and fail-closed in production.

### Decisions fixed by this PRD

- Product name remains Microcosm.
- The first product is a consumer-facing app, not only a developer API or payment form.
- Mobile is the primary form factor; desktop is an extensible responsive layout over the same app.
- Persistent Microcosm identity is separate from authentication credentials and wallet addresses.
- The initial Space is personal; shared Spaces are a planned expansion.
- Arc mainnet and USDC are the first live settlement path.
- User transfers are authorized through the user's wallet/provider, not a shared API private key.
- Mainnet proof and exact transaction evidence are release gates.

### Decisions to verify before implementation

- Exact Privy login methods and embedded-wallet recovery/control configuration.
- Whether the initial release supports only Privy embedded wallets or also an external-wallet connector.
- Authoritative Arc mainnet USDC contract address and RPC health behavior.
- Whether an onchain memo mechanism is necessary for v0.1 or whether purpose stays as offchain receipt metadata.
- Deployment platform, production API domain, database hosting and secret manager.

---

## 13. Final acceptance checklist

A release is not complete until all applicable items are verified:

- [ ] Clean install and reproducible lockfile.
- [ ] Typecheck and test suite pass.
- [ ] Production config explicitly selects Arc mainnet and checks chain ID.
- [ ] Official USDC contract address is configured and verified.
- [ ] Authenticated user gets one stable Microcosm identity.
- [ ] User gets one personal Space with durable ownership.
- [ ] Recovery flow works and preserves identity continuity.
- [ ] Wallet control/recovery model is explained accurately.
- [ ] Wallet address and balance are read from the expected Arc account.
- [ ] Send flow reviews recipient, chain, asset and amount before wallet approval.
- [ ] Invalid/stale intents are blocked.
- [ ] Wallet returns a real tx hash and the API binds it to the authenticated owner.
- [ ] Confirmation worker verifies receipt and expected token transfer.
- [ ] Duplicate callbacks/retries cannot create duplicate payment execution or records.
- [ ] Receive QR and copy address identify the correct network.
- [ ] Activity records survive server restart and match chain evidence.
- [ ] User-owned API resources cannot be accessed by another principal.
- [ ] Private identity fields are not emitted onchain.
- [ ] No simulated result can be mistaken for a real transfer.
- [ ] App works at mobile and desktop viewport sizes.
- [ ] Public deployment and public repository are accessible.
- [ ] At least one deployed mainnet transaction can be independently verified.



## 14. Technical reference links

- [Arc RPC endpoints and chain IDs](https://docs.arc.io/arc/references/rpc-endpoints)
- [Arc contract addresses and USDC interface](https://docs.arc.io/arc/references/contract-addresses)
- [Arc EVM differences](https://docs.arc.io/arc/references/evm-differences)
- [Privy connect or create wallet](https://docs.privy.io/wallets/connectors/usage/connect-or-create)
- [Privy transaction signing](https://docs.privy.io/wallets/using-wallets/ethereum/send-a-transaction)

The links are implementation references, not evidence that Microcosm already has these integrations working end-to-end.
