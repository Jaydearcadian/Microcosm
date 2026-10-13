# Microcosm Technical Specification

**Version:** 0.1.0  
**Status:** Proposed target architecture, grounded in the uploaded repository baseline  
**Prepared:** 2026-10-13  
**Companion:** [MICROCOSM_PRD.md](./MICROCOSM_PRD.md)

This specification defines the implementation target for the first consumer release. Existing code is a backend foundation, not proof that every target component is implemented or safe. Requirements below use `MUST`, `SHOULD`, and `MAY` in their ordinary engineering sense.

---

## 1. Architecture decisions

1. **Monorepo:** preserve the TypeScript workspace and existing domain packages. Add a dedicated `apps/web` consumer frontend.
2. **API-first:** the browser must consume the same versioned domain API that future SDKs and clients use. Do not duplicate business rules in React components.
3. **Internal principal:** Microcosm owns a stable internal user ID. Privy IDs are external identity references, not the canonical product ID.
4. **Space is the root operating context:** each new user receives a personal Space. Shared Spaces can extend the model later.
5. **Privy is the first authentication/wallet adapter:** browser and server SDKs have different responsibilities. Server auth verification does not imply server permission to sign user transactions.
6. **Arc mainnet is the initial settlement rail:** chain configuration is explicit. Production must fail closed if its configured chain and RPC do not match.
7. **PostgreSQL is durable application state:** payment intents, payment records, transaction references, ledger and audit events must survive process restarts.
8. **User-signed transfers:** transfer execution for the initial consumer app uses the user's connected/provisioned wallet. A shared server private key is not used to sign customer transfers.
9. **Chain evidence is settlement truth:** database status is a projection that must be reconciled against chain receipts and expected token transfers.
10. **No unsafe existing escrow reuse:** current `ClaimEscrow` and `SettlementRouter` need a separate contract review before any public deployment.

---

## 2. Repository target layout

Keep existing packages and add the following structure incrementally:

```text
Microcosm-main/
├── apps/
│   ├── web/                         # New Next.js/React responsive consumer web app
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── identity/
│   │   │   ├── home/
│   │   │   ├── money/
│   │   │   ├── people/
│   │   │   ├── activity/
│   │   │   ├── space/
│   │   │   └── settings/
│   │   ├── lib/
│   │   └── tests/
│   ├── api/                         # Existing API, move toward /v1
│   └── worker/                      # Existing worker; harden leases/retries
├── packages/
│   ├── api-contracts/               # New versioned Zod request/response schemas
│   ├── identity/                    # Stable principal, login links, wallet bindings
│   ├── spaces/                      # New Space/member/role domain model
│   ├── recipient-resolution/
│   ├── envelopes/
│   ├── policy-engine/
│   ├── intents/
│   ├── payments/
│   ├── settlement/
│   ├── ledger/
│   ├── audit/
│   ├── notifications/
│   ├── db/
│   └── adapters/
└── docs/
    ├── MICROCOSM_PRD.md
    └── MICROCOSM_TECHNICAL_SPEC.md
```

### 2.1 Frontend framework

Use Next.js/React with TypeScript for the web app. The repository already uses TypeScript and includes `@privy-io/react-auth`; however, frontend installation and compatible package versions must be validated in a clean workspace before relying on them.

Requirements:

- responsive mobile-first shell;
- client-side wallet interactions initiated from explicit user actions;
- typed calls to the versioned API;
- no server keys in browser bundles;
- no authoritative balances or transaction statuses invented in client state;
- accessible inputs, keyboard interactions, and focus states;
- deployable to a public HTTPS origin.

### 2.2 Shared contracts

The API uses JSON and a versioned route prefix: `/v1`. Request/response schemas should be shared or generated from a canonical package. The current HTTP server uses unversioned paths, so implementation must choose one migration strategy: mount `/v1` as the canonical contract and optionally keep a short-lived compatibility layer, or migrate all callers in one controlled change. New frontend code must not depend on undocumented unversioned response shapes.

---

## 3. Component boundaries

### 3.1 Web application

Owns presentation and user interaction:

- login UI and wallet-provider UI;
- current principal and Space selection display;
- form state and client-side validation for usability;
- explicit payment review and user invocation of wallet signing;
- presentation of API status and chain-derived transaction evidence.

It does not own final authorization, access control, settlement completion, or durable payment lifecycle state.

### 3.2 API

Owns authenticated application operations:

- verify Privy session/token on the server;
- map provider identity to a Microcosm principal;
- load and authorize the active Space;
- perform server-side schema, amount, recipient and rule validation;
- create durable intents and payment records;
- prepare exact transaction details for user signature;
- record a submitted transaction hash tied to the authenticated principal;
- expose payment and activity status;
- keep audit history and issue idempotent responses.

The API must never accept a client-supplied `userId`, `privyUserId`, `ownerId`, or `SpaceId` as proof of ownership. Those identifiers may be inputs to a requested operation, but authorization must be derived from the verified session and server-side membership records.

### 3.3 Domain services

Each package owns its rules and types. The HTTP layer maps requests to domain inputs and must not duplicate policy, identity, or settlement rules.

- `identity`: principal and linked external identities;
- `spaces`: personal/shared Space lifecycle, membership and role checks;
- `recipient-resolution`: discover a supported recipient/address association without leaking private identity data;
- `envelopes` and `policy-engine`: rules and deterministic evaluation;
- `intents`: structured, versioned user intent lifecycle;
- `payments`: payment record and user-facing lifecycle;
- `settlement`: RPC read, transaction/receipt verification, confirmation and reconciliation;
- `ledger`: append-only bookkeeping events, not substitute chain evidence;
- `audit`: consequential application events;
- `notifications`: retryable notifications, never settlement truth.

### 3.4 Worker

The worker handles asynchronous and retryable tasks:

- transaction receipt checks;
- confirmation and reconciliation;
- notification delivery;
- cleanup of expired intents;
- recovery of expired job leases;
- future scheduled payment jobs only after authorization requirements are implemented.

Every job must be idempotent, leased durably, and safe under retries. Repeated receipt polling must not resubmit a transaction. Permanent errors go to an observable dead-letter state.

### 3.5 Adapters

- Privy adapter: server-side session/user verification and provider API operations. Browser wallet signing remains in the Privy React wallet API.
- Arc adapter: chain metadata, ERC-20 balance reads, transaction submission only through the wallet signer or provider as appropriate, receipt/log reads and chain health.
- PostgreSQL: durable system of record for application principals, Spaces, recipient associations, intents and payment projections.
- XMTP: optional communication adapter; not on the first critical path.
- Allium / Uniblock: optional read/reconciliation integrations; core balances and transaction receipts must have a stated source and failure behavior.
- Existing market adapters (Myriad, Polymarket, Hyperliquid, Lighter): outside the consumer v0.1 payment path; keep disabled unless a separate product need is confirmed.

---

## 4. External network and wallet configuration

### 4.1 Arc configuration

The uploaded repository recognizes `ARC_NETWORK=mainnet`, but production behavior must be made explicit across the Arc adapter, API, web app, worker, contract client and health checks.

Target configuration:

```dotenv
ARC_NETWORK=mainnet
ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io
ARC_MAINNET_CHAIN_ID=5042
ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

Testnet is an explicit development mode only:

```dotenv
ARC_NETWORK=testnet
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.io
ARC_TESTNET_CHAIN_ID=5042002
ARC_TEST_USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

Implementation requirements:

- app startup/ready check calls `eth_chainId` and fails if it differs from configured chain ID;
- never silently default a production deployment to testnet;
- a production build cannot read an arbitrary token address from user input;
- token decimals and symbol are verified against the configured contract;
- the official token address is a deployment input confirmed from official Arc documentation, not guessed from examples;
- testnet and mainnet manifests remain separate;
- every receipt and transaction record stores chain ID.

### 4.2 USDC amount and gas rules

Arc has a network-specific distinction that must be implemented deliberately:

- Arc's native USDC balance used for gas has 18 decimal places.
- The optional ERC-20 interface at `0x3600000000000000000000000000000000000000` uses 6 decimals and exposes `balanceOf`, `transfer`, `approve`, and other ERC-20 methods against the same underlying USDC balance.
- For app payment amounts and balance reads, use the documented ERC-20 interface and confirm its `decimals()` result. Do not mix the native `eth_getBalance` 18-decimal representation with ERC-20 6-decimal units or count them as two balances.
- API payloads use decimal strings such as `"12.34"`, not JavaScript floating-point amounts.
- Convert to integer base units with a decimal-safe utility.
- Reject non-finite values, exponent notation unless normalized explicitly, zero/negative values, precision greater than token decimals, and amounts above balance/policy limits.
- Display the amount, asset and network explicitly before signature.
- Gas estimates must follow current Arc fee guidance. Do not assume Ethereum's gas-token model or hardcode a fee parameter without testing it against Arc's current network policy.

### 4.3 Wallet execution model

The initial consumer payment uses a Privy embedded wallet or a supported connected external EVM wallet. The preferred default is an embedded wallet provisioned through the user's chosen authentication method, with external wallet support isolated behind the wallet adapter.

The app will use the current supported Privy React APIs to connect/create and sign a transaction. The exact API and provider configuration must be validated against the installed package version. Do not mix incompatible old/new examples into one implementation.

The flow is:

1. Web requests a prepared payment intent from the API.
2. API authenticates the principal and validates recipient, asset, amount, policy, and Space scope.
3. API returns exact transaction request fields plus intent ID and expiry.
4. Web validates chain and asks the wallet provider to sign/send from the user's wallet.
5. Provider returns a transaction hash.
6. Web posts the hash to the API with an idempotency key.
7. API verifies that sender wallet matches the authorized wallet binding and that chain ID matches.
8. Worker reads the transaction and receipt, verifies target token transfer, and updates status.
9. Web polls or subscribes to payment state and displays truthful status.

A wallet provider's transaction hash proves submission request acknowledgement, not success. Success requires a successful receipt and a matching token transfer.

### 4.4 Server signing keys

`ARC_SETTLEMENT_PRIVATE_KEY` exists in the current backend config. It must not be used to sign a customer's ordinary direct transfer in the initial consumer app.

If a deployed contract admin requires an owner/deployer key, isolate it as a contract administration credential, use a separate address from consumer funds, keep it out of browser code, store it in a secret manager, and do not let it authorize arbitrary transfers from users.

---

## 5. Identity and recovery model

### 5.1 Domain types

```ts
type MicrocosmUser = {
  id: string;                     // stable internal ID, e.g. usr_<opaque-id>
  status: "active" | "suspended" | "deletion_pending";
  createdAt: string;
  updatedAt: string;
};

type ExternalIdentity = {
  id: string;
  userId: string;
  provider: "privy";
  providerSubject: string;
  identityType: "email" | "social" | "passkey" | "wallet" | "other";
  verifiedAt?: string;
  createdAt: string;
  revokedAt?: string;
};

type WalletBinding = {
  id: string;
  userId: string;
  spaceId: string;
  address: `0x${string}`;
  chainType: "evm";
  role: "primary" | "additional";
  provider: "privy" | "external";
  verification: "provider_attested" | "signature_verified" | "unverified";
  status: "active" | "disconnected" | "revoked";
  createdAt: string;
};
```

`providerSubject` must be treated as a sensitive external identifier, not a public username. Email should not be the primary key for a Microcosm account.

### 5.2 Account synchronization

`GET /v1/me` returns the current user's Microcosm principal, Spaces, safe profile attributes, and linked-wallet summary. If the user is authenticated by Privy but no Microcosm principal exists, an idempotent synchronization service creates the principal and personal Space in one database transaction.

Constraints:

- unique mapping from `(provider, providerSubject)` to one Microcosm user;
- unique active personal Space per user;
- account linking requires a verified session for the account being linked and proof/approval for the newly linked method;
- do not merge solely by equal email strings;
- provider deletion/account changes are reconciled explicitly rather than silently mapping to a new principal.

### 5.3 Recovery semantics

The PRD requires a recoverable user experience, but recovery implementation is defined by the selected Privy configuration. The implementation must document:

- authentication methods supported;
- what the provider can recover;
- what is required on a new device;
- how embedded wallet access is restored;
- whether a linked external wallet must be reconnected separately;
- what happens if the user loses all configured authentication methods.

Acceptance test:

1. Create a user with a personal Space and wallet binding.
2. Record internal user ID and wallet address.
3. End the session and open a clean browser profile or second device.
4. Recover through a configured method.
5. Call `GET /v1/me` and verify same Microcosm user ID and Space ID.
6. Verify expected wallet access/control, not just that the UI shows the old address.
7. Verify there are no duplicate users, orphaned Spaces or silently replaced wallet addresses.

---

## 6. Space model

### 6.1 Type

```ts
type Space = {
  id: string;
  type: "personal" | "shared";
  name: string;
  ownerUserId: string;
  status: "active" | "suspended" | "archived";
  createdAt: string;
  updatedAt: string;
};

type SpaceMembership = {
  spaceId: string;
  principalType: "user" | "agent" | "service";
  principalId: string;
  role: "owner" | "admin" | "operator" | "member" | "viewer";
  status: "active" | "invited" | "suspended" | "revoked";
  createdAt: string;
};
```

For v0.1, only `personal` Space creation and read access are required. The broader membership schema is designed for extension but must not imply that the authorization system or shared financial actions already exist.

### 6.2 Scoping

Sensitive application records must be scoped to a `userId` and/or `spaceId`, including recipients, envelopes, intents, payments, notifications, audit events and future mandates. Authorization is enforced in the API and in repository query filters, not only in the frontend.

---

## 7. Target data model

Names are logical; migration naming may follow repository conventions. Use UUIDs or opaque IDs for public resource identifiers. Do not place PII inside public IDs.

### `users`

- `id` primary key
- `status`
- `created_at`, `updated_at`

### `external_identities`

- `id` primary key
- `user_id` foreign key
- `provider`
- `provider_subject`
- `identity_type`
- `verified_at`, `revoked_at`
- unique `(provider, provider_subject)`

### `profiles`

- `user_id` primary key/foreign key
- `display_name`
- optional public handle with reservation/collision rules
- optional avatar URL
- avoid unnecessary personal data

### `spaces`

- `id` primary key
- `type`, `name`, `owner_user_id`, `status`
- `created_at`, `updated_at`
- unique constraint for active personal Space per owner

### `space_memberships`

- `space_id`, `principal_type`, `principal_id`, `role`, `status`
- unique active membership per principal and Space

### `wallet_bindings`

- `id`, `user_id`, `space_id`, `address`, `chain_type`, `chain_id`, `provider`, `verification`, `role`, `status`
- normalized EVM address plus explicit chain semantics
- unique active binding constraints as appropriate

### `recipients`

- `id`, `owner_user_id`, `space_id`, `recipient_type`, `display_label`, `status`, `created_at`, `updated_at`
- no requirement to expose raw lookup keys in API responses

### `recipient_wallets`

- `id`, `recipient_id`, `chain_id`, `address`, `verification`, `verified_by`, `verified_at`, `status`
- unique active `(chain_id, address)` per association where appropriate

### `identity_lookup_tokens` (only if handle/email claiming is enabled)

- store keyed/HMAC lookup values or provider-safe opaque references, never a raw predictable email hash as the only protection;
- `recipient_id`, `purpose`, `expires_at`, `consumed_at`, `created_at`;
- single-use token digest; raw token only sent through intended channel and never logged.

### `envelopes`

- `id`, `space_id`, `owner_user_id`, `asset_id`, `rules_json`, `version`, `status`, timestamps
- each change creates a version or immutable snapshot for prior intent evaluation

### `intents`

- `id`, `space_id`, `owner_user_id`, `type`, `status`, `recipient_id`, `asset_id`, `amount_base_units`, `chain_id`, `purpose_metadata_json`, `envelope_id`, `envelope_version`, `expires_at`, timestamps
- amount persisted as integer base units or validated decimal string; never floating point

### `payments`

- `id`, `space_id`, `owner_user_id`, `intent_id`, `sender_wallet_binding_id`, `recipient_id`, `chain_id`, `token_address`, `amount_base_units`, `status`, `tx_hash`, timestamps
- unique `(chain_id, tx_hash)` when hash is present
- unique idempotency record for creation/submission

### `settlements`

- `id`, `payment_id`, `chain_id`, `mode`, `status`, `tx_hash`, `block_number`, `block_hash`, `receipt_status`, `verification_json`, timestamps
- settlement projection is updated only from known transaction evidence

### `ledger_entries`

- append-only event/entry representation with `space_id`, `user_id`, `entry_type`, `asset_id`, `amount_base_units`, reference type/ID, timestamp, evidence reference
- not a replacement for onchain balance

### `audit_events`

- `id`, `space_id`, `actor_type`, `actor_id`, `event_type`, `object_type`, `object_id`, `payload_redacted_json`, timestamp, correlation/request ID
- do not log secrets or raw claim tokens

### `worker_jobs`

- `id`, `job_type`, `dedupe_key`, `status`, `payload_json`, `attempt_count`, `available_at`, `lease_owner`, `lease_expires_at`, `last_error_code`, `completed_at`, timestamps
- unique dedupe key for a job when the type requires one

### Migration policy

The current repository has an initial schema and JSONB-backed application repository. Before release:

- add an ordered migration mechanism;
- add explicit relational uniqueness constraints for identity/transaction invariants;
- use transactions for principal + Space creation, intent/payment writes, and submitted-transaction recording;
- avoid making the complete app dependent on only an in-memory collection or JSON snapshot;
- test restart and concurrent retry behavior.

---

## 8. Payment and settlement state machine

### 8.1 Payment states

```text
DRAFT
  -> VALIDATING
  -> READY_FOR_SIGNATURE
  -> SIGNATURE_REQUESTED
  -> SUBMITTED
  -> CONFIRMING
  -> CONFIRMED

Pre-submission terminal/exception paths:
  VALIDATING -> REJECTED
  READY_FOR_SIGNATURE -> EXPIRED
  READY_FOR_SIGNATURE -> CANCELLED

Post-submission paths:
  SUBMITTED/CONFIRMING -> FAILED          (only when definitive chain failure is known)
  SUBMITTED/CONFIRMING -> NEEDS_RECONCILIATION (when state is ambiguous or evidence conflicts)
```

Allowed transitions must be encoded centrally. The UI cannot set status directly.

### 8.2 Definitions

- `DRAFT`: local input only; no durable payment execution record required yet.
- `VALIDATING`: server-side request validation and policy checks are running.
- `READY_FOR_SIGNATURE`: a prepared transaction and immutable intent snapshot exist; intent has not expired.
- `SIGNATURE_REQUESTED`: the user invoked the wallet provider.
- `SUBMITTED`: a valid transaction hash was returned and persisted with chain ID and authenticated owner.
- `CONFIRMING`: transaction is found but final receipt/transfer verification is incomplete.
- `CONFIRMED`: successful receipt and expected USDC transfer evidence verified.
- `REJECTED`: invalid recipient/amount/chain/rule or unauthorized operation.
- `EXPIRED`: prepared intent expired before submission.
- `CANCELLED`: user cancelled before transaction submission.
- `FAILED`: chain reports a definitive reverted/failed transaction.
- `NEEDS_RECONCILIATION`: provider/RPC state is ambiguous, unavailable beyond retry policy, or does not match expected transaction data.

### 8.3 Transaction verification

A confirmed transfer must match all of:

- configured chain ID;
- configured USDC contract address;
- transaction hash and successful receipt;
- expected sender wallet;
- expected recipient address;
- expected integer token amount;
- appropriate ERC-20 transfer log from the configured token contract.

If the app uses a custom settlement contract in a future phase, verification must instead validate the relevant contract event and resulting token movement against the exact intent. Event presence alone is insufficient if the amount or recipient does not match.

### 8.4 Retry and idempotency

- Creation requests require an `Idempotency-Key` or equivalent server-managed key.
- `tx_hash` is persisted before asynchronous receipt polling.
- Worker jobs use a durable lease and dedupe key such as `confirm:<chainId>:<txHash>`.
- After timeouts, query the known hash before taking another action.
- If wallet submission returned no hash due to provider interruption, the UI must tell the user the result is unknown and direct them to inspect wallet activity before repeating the payment.
- No retry path may automatically submit a second transfer merely because the first receipt poll timed out.

---

## 9. REST API contract (target)

Base path: `/v1`. All user routes require a verified session. Resource access is principal/Space scoped. Use JSON schemas and consistent error envelopes.

### 9.1 Common response

Success:

```json
{
  "data": {},
  "requestId": "req_opaque"
}
```

List:

```json
{
  "data": [],
  "page": { "nextCursor": null },
  "requestId": "req_opaque"
}
```

Error:

```json
{
  "error": {
    "code": "recipient_not_found",
    "message": "The selected recipient could not be resolved.",
    "details": {},
    "requestId": "req_opaque"
  }
}
```

HTTP mapping: 400 invalid request, 401 unauthenticated, 403 unauthorized, 404 not found, 409 idempotency/state conflict, 413 payload too large, 422 policy rejection, 429 rate limited, 500 unexpected failure, 503 required dependency unavailable.

### 9.2 Identity and Space

- `GET /v1/me`: verified user summary, linked login methods safe summary, wallet bindings, active Space.
- `POST /v1/me/sync`: idempotently synchronize a verified provider identity and ensure the principal/personal Space exist. Must be called only after server-side provider-token verification.
- `PATCH /v1/me/profile`: update safe display attributes.
- `GET /v1/spaces`: list Spaces available to the current principal.
- `GET /v1/spaces/:spaceId`: fetch permitted Space metadata.
- `PATCH /v1/spaces/:spaceId`: update supported settings after authorization.

### 9.3 Wallet and balance

- `GET /v1/wallets`: list wallet bindings for the current user/Space.
- `POST /v1/wallets/associate`: register a provider-verified or signature-verified wallet binding. Never trust an unproven address sent by the client.
- `GET /v1/balances?spaceId=...&chainId=5042&asset=USDC`: obtain a fresh or timestamped balance. Response includes source and observed time.
- `GET /v1/networks`: return supported network metadata and configured token contract addresses.

### 9.4 Recipients

- `GET /v1/recipients?spaceId=...`: list current principal's saved recipients.
- `POST /v1/recipients`: create a saved recipient label and wallet association.
- `POST /v1/recipients/resolve`: resolve a supported wallet address or private identity handle through the privacy-safe resolver.
- `GET /v1/recipients/:recipientId`: read a recipient only if owned or otherwise authorized.
- `PATCH /v1/recipients/:recipientId`: update user label or enabled fields.
- `DELETE /v1/recipients/:recipientId`: archive/remove saved recipient association.

Never include raw emails or internal private lookup keys in public recipient responses. A caller must not be able to enumerate all users by submitting emails one by one.

### 9.5 Intents and payments

- `POST /v1/intents`: create validated intent and store the policy snapshot.
- `GET /v1/intents/:intentId`: read an authorized intent.
- `POST /v1/intents/:intentId/prepare`: revalidate state and return exact unsigned transaction parameters plus intent expiry.
- `POST /v1/payments`: create a payment projection linked to the intent and idempotency record; does not mean payment submitted.
- `POST /v1/payments/:paymentId/submitted`: record user-provider transaction hash, chain ID and sender association.
- `GET /v1/payments?spaceId=...&cursor=...`: list authorized payment records.
- `GET /v1/payments/:paymentId`: get current status and evidence.
- `GET /v1/payments/:paymentId/receipt`: obtain a privacy-safe receipt containing verified chain fields and clearly separated offchain purpose metadata.

Do not expose a public API endpoint that lets an unauthenticated caller execute a payment or mark settlement complete. If a server execution endpoint is later required for an authorized service/agent, it must use a distinct authority model and route family.

### 9.6 Activity and security

- `GET /v1/activity?spaceId=...&cursor=...`: merged projection from authorized payment and audit event records.
- `GET /v1/security/sessions`: supported provider session metadata, if available.
- `POST /v1/security/recovery-check`: optional non-sensitive diagnostic of configured recovery readiness; must never expose secrets.

### 9.7 Health

- `GET /v1/health`: process liveness only.
- `GET /v1/healthz`: dependency health for database and configured Arc RPC.
- `GET /v1/readyz`: readiness; returns 503 if critical dependencies or schema version are not ready.

### 9.8 Removed or restricted existing routes

Current unversioned endpoints include `/payments/:id/execute`, `/execute-async` and `/claim`. These must not remain open unauthenticated in a production deployment. The public consumer flow is wallet-authorized. Legacy routes can be kept for local tests only or moved behind authenticated service authorization until removed.

---

## 10. Authentication and authorization middleware

Every request except liveness health must pass through the correct auth boundary.

### 10.1 Browser requests

- Web obtains a session through Privy.
- Web sends the supported access token to the API using the provider-recommended secure pattern.
- API verifies the token and resolves it to a Microcosm principal.
- Request context includes `userId`, permitted Space IDs/roles, request ID and auth method metadata.

### 10.2 Service/worker requests

Workers use a separate service identity or network-isolated credential. User bearer tokens are not reused as worker credentials. Service credentials are scoped to required operations and rotate through secret management.

### 10.3 Authorization checklist

- resource owner matches authenticated principal or caller has required Space role;
- route operation is permitted for actor type and record state;
- target Space is active and accessible;
- request asset/chain are allowed;
- prepared intent is not expired or consumed;
- idempotency key has not been reused with a different payload;
- the target wallet belongs to the authenticated principal or explicitly authorized principal;
- record status transition is allowed by the state machine.

---

## 11. Notifications and external messaging

XMTP is not a dependency for core send/receive. It may be added once payments and identity are stable.

If enabled:

- notification records reference source objects and can be retried;
- XMTP delivery is not evidence of settlement;
- unknown recipients receive only safe, user-approved invitation data;
- identity association and claim URLs use high-entropy short-lived tokens;
- never include raw private lookup keys or auth tokens in messages/logs;
- a failed message does not roll back a valid onchain transfer.

Allium/Uniblock may assist with reads or reconciliation but cannot silently override a failed or contradictory RPC/receipt result. The integration's provenance and freshness must be recorded.

---

## 12. Observability and operations

Required structured fields:

- `requestId`, `correlationId`, `userId`/actor (internal opaque ID), `spaceId`, `intentId`, `paymentId`, `settlementId`, `jobId`;
- chain ID and transaction hash where available;
- integration/source and observation timestamp;
- status transition and error code;
- retry attempt and lease metadata.

Never log private keys, secrets, provider access tokens, raw claim tokens, or full PII.

Operational requirements:

- liveness/readiness endpoints;
- database migration-version check;
- Arc RPC chain-ID check;
- alert/log when a submitted transaction cannot be reconciled after bounded retries;
- worker retries use exponential backoff with jitter and an upper bound;
- dead-lettered jobs are inspectable and replay requires an explicit safe operation;
- containerized API must bind to `0.0.0.0` (or configured host) when deployed behind a container port mapping;
- graceful shutdown does not mark in-flight transactions failed or completed without evidence.

---

## 13. Test strategy

### 13.1 Unit tests

- email/handle normalization and private lookup behavior;
- stable principal mapping and duplicate-link prevention;
- personal Space idempotent creation;
- wallet binding verification and uniqueness;
- decimal conversion to/from base units;
- envelope and policy evaluation;
- intent expiry and snapshot immutability;
- payment state transition matrix;
- idempotency-key collision behavior;
- address, token, chain and amount validation;
- error mapping and response schemas.

### 13.2 Integration tests

- Privy session verification and provider user synchronization using official SDK test seams;
- Postgres migrations on an empty database;
- identity/Space/payment survive API restart;
- unauthorized principal cannot retrieve another principal's records;
- prepared intent cannot be changed after approval;
- submitted hash is accepted only for correct chain and authorized sender;
- duplicate submission callback is idempotent;
- worker lease expiry/reclaim and concurrent worker behavior;
- receipt verification rejects wrong token, recipient, sender or amount;
- notification failure does not mutate payment settlement status.

### 13.3 Wallet and Arc acceptance tests

- wallet absent;
- wallet connects or is provisioned;
- wrong network detected and corrected;
- zero/low balance;
- invalid recipient;
- user cancels signature;
- provider returns hash;
- RPC does not find transaction yet;
- successful transaction/receipt/Transfer log;
- reverted transaction;
- RPC outage after submission;
- UI refresh during pending state;
- repeated submit click;
- clean browser/new-device recovery;
- independently open the confirmed hash in Arc explorer and compare every displayed chain field.

### 13.4 Contract tests before any escrow route is enabled

- replayed payment ID;
- privacy-safe recipient binding;
- claim authorization independent of a privileged owner choosing any destination;
- claim expiry and depositor refund;
- reentrancy and token failure scenarios;
- amount/token/recipient mismatch;
- state transition and double-claim protection;
- pause/emergency handling;
- correct event-to-payment evidence binding.

The current `packages/contracts/test/SettlementFlows.t.sol` is a starting point, not a replacement for these additional test cases.

---

## 14. Acceptance gates

### Gate A: reproducible local build

- clean dependency install;
- lockfile and manifests consistent;
- typecheck and tests pass;
- database schema migrations apply from zero;
- API and worker health/readiness behave correctly.

### Gate B: identity continuity

- stable user + Space mapping;
- provider-token verification;
- no duplicate principal on repeated login;
- recovery preserves the intended internal identity and wallet access;
- unauthorized record access rejected.

### Gate C: live Arc payment

- network and token address verified;
- wallet prompts with exact transaction;
- user authorizes transfer;
- hash persists idempotently;
- receipt/log reconciled;
- exact sender, recipient and amount shown;
- no simulated success path can satisfy the gate.

### Gate D: deployable consumer application

- public HTTPS web app;
- mobile and desktop routes work;
- no secret in browser bundle or repository;
- empty/error/pending states tested;
- real chain data presented accurately;
- public repo includes documented setup and evidence links.

Only after Gates A-D pass should the system be described as the live Microcosm v0.1 release.

---

## 15. Known repository gaps to resolve

Based on the supplied `Microcosm-main.zip`:

1. No consumer frontend exists in the repository yet.
2. Existing API paths are unversioned and the HTTP route handlers do not enforce user authentication/ownership authorization.
3. The API runtime expects a settlement private key, even though customer transfers should be user-authorized for this product.
4. Arc configuration and the first-party Arc adapter are testnet-oriented in places. Mainnet mode must be consistently propagated and chain-ID checked across API, worker and web.
5. No committed live mainnet deployment/address evidence is present in the supplied ZIP; the deployment manifest is an example with placeholder addresses.
6. Identity persistence is based on Privy user ID/email and wallet address; external-identity linking, stable Microcosm principal, wallet-binding lifecycle and recoverability need a fuller model.
7. Space is not yet a domain package in this repository and must be added to the canonical model.
8. The current `ClaimEscrow` exposes the raw lookup key in storage/events, lets only the owner claim to a supplied address, and has no refund/expiry lifecycle. Do not deploy unchanged.
9. The current `SettlementRouter` does not mark payment IDs consumed, so it is not replay protected by its derived settlement ID.
10. Worker lease/retry/dead-letter behavior and settlement reconciliation need explicit integration acceptance evidence.
11. Root dependency manifest and lockfile need a clean reproducible install and consistent dependency resolution.
12. Current code/docs contain inconsistent statements about worker/persistence maturity. Update a single status ledger after each verified implementation slice.
13. Current container startup should be verified against interface binding/port mapping before deployment.
14. Existing market adapters are not required for the first consumer slice and should not expand the critical path.

---

## 16. Build sequence for implementation agents

Perform one vertical slice at a time. Each slice must include implementation, tests, updated status/evidence, and a review for overclaims.

1. **Baseline:** clean install, run tests/typecheck, inventory failures; do not edit identity or settlement semantics during baseline collection.
2. **Security foundation:** version API, add verified auth middleware, principal resolution, resource ownership checks, idempotency middleware, and integration tests.
3. **Identity + Space:** stable principal mapping, external identity table, personal Space transaction, wallet binding, recovery acceptance test.
4. **Web shell:** responsive app shell, route structure, authentication, loading/error/empty states, authenticated API client.
5. **Wallet + read path:** wallet provisioning/connection, strict Arc network selection, verified USDC balance reader.
6. **Send/receive path:** create intent, server validation, prepare exact transaction, user signing, hash recording, receipt reconciliation, QR receiving screen.
7. **Activity:** persisted read model and chain-verified receipt views.
8. **Deploy:** secure env/secrets, database migrations, API bind/health, web deployment, mainnet smoke test, public evidence bundle.
9. **Post-release:** email claims, payment requests, shared Spaces, envelopes UI, XMTP, additional adapters.

Do not start shared treasury, cross-chain routing, agents, or new financial contracts until the first real end-to-end transaction and identity recovery pass their independent acceptance gates.


---

## 17. Primary technical references

Use current official documentation during implementation and recheck these links before deployment because network settings and SDK APIs can change:

- [Arc RPC endpoints and network parameters](https://docs.arc.io/arc/references/rpc-endpoints): mainnet chain ID `5042`, testnet chain ID `5042002`, mainnet RPC `https://rpc.mainnet.arc.io`, testnet RPC `https://rpc.testnet.arc.io`.
- [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses): USDC ERC-20 interface address `0x3600000000000000000000000000000000000000`; optional interface uses 6 decimals and shares the native USDC balance.
- [Arc EVM differences](https://docs.arc.io/arc/references/evm-differences): Arc-specific execution, native USDC and event behavior.
- [Arc transaction memos](https://docs.arc.io/arc/concepts/transaction-memos): optional purpose-metadata path; verify the exact interface and event before relying on it.
- [Privy connect or create wallet](https://docs.privy.io/wallets/connectors/usage/connect-or-create): connect an external EVM wallet or create an embedded wallet through supported login methods.
- [Privy send an Ethereum transaction](https://docs.privy.io/wallets/using-wallets/ethereum/send-a-transaction): client-authorized transaction path and signer API.
- [XMTP Browser SDK](https://docs.xmtp.org/chat-apps/sdks/browser): possible later browser messaging adapter.

These references inform implementation choices but do not prove that the corresponding integration has been completed in this repository.
