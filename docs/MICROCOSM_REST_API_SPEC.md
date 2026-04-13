# Microcosm REST API Specification

## 1. Purpose

This document defines the intended developer-facing REST API for Microcosm.

The API is the canonical contract for:

- web applications
- SDKs
- CLIs
- internal operators
- agent and MCP tools

The current codebase already exposes a subset of this API. This document defines the stable target shape.

## 2. API Principles

- business primitives first
- typed JSON request and response bodies
- idempotent mutation support
- stable resource IDs
- consistent error model
- pagination for list endpoints
- explicit health and readiness endpoints

## 3. Base URL and Versioning

Recommended production base:

- `/v1`

Example:

- `https://api.mcosm.dev/v1`

Local development:

- `http://127.0.0.1:3000/v1`

The current repo does not yet mount `/v1`, but all new work should target that versioned shape.

## 4. Authentication

Initial recommendation:

- server-issued API keys for backend and operator access
- bearer token format

Header:

```http
Authorization: Bearer <token>
```

Future additions:

- org-scoped API keys
- user-session auth for console applications
- webhook signature validation

## 5. Common Headers

Recommended common headers:

- `Authorization`
- `Content-Type: application/json`
- `Idempotency-Key`
- `X-Request-Id`

## 6. Common Response Shape

For single-resource success:

```json
{
  "data": {}
}
```

For list success:

```json
{
  "data": [],
  "page": {
    "nextCursor": null
  }
}
```

For errors:

```json
{
  "error": {
    "code": "recipient_not_found",
    "message": "Recipient was not found",
    "requestId": "req_123"
  }
}
```

## 7. Error Model

Standard error fields:

- `code`
- `message`
- `requestId`
- optional `details`

Suggested HTTP status mapping:

- `400` validation error
- `401` unauthorized
- `403` forbidden
- `404` not found
- `409` conflict
- `422` rule violation
- `429` rate limit
- `500` internal error
- `503` degraded dependency state

## 8. Health Endpoints

### 8.1 `GET /v1/health`

Purpose:

- liveness only

Response:

```json
{
  "data": {
    "ok": true,
    "service": "microcosm-api"
  }
}
```

### 8.2 `GET /v1/healthz`

Purpose:

- dependency health

Checks:

- Postgres
- Arc RPC
- Privy config

### 8.3 `GET /v1/readyz`

Purpose:

- deployment readiness

Return `503` if runtime dependencies are degraded.

## 9. Recipient API

### 9.1 `POST /v1/recipients/resolve`

Purpose:

- resolve email, agent ID, or wallet address into a recipient record

Request:

```json
{
  "email": "alice@gmail.com"
}
```

Allowed request variants:

- `email`
- `agentId`
- `walletAddress`

Response:

```json
{
  "data": {
    "id": "pending:alice@gmail.com",
    "ownerType": "external",
    "claimStatus": "pending-claim",
    "lookupKey": "alice@gmail.com"
  }
}
```

### 9.2 `GET /v1/recipients`

Purpose:

- list recipients

Suggested filters:

- `claimStatus`
- `ownerType`
- `lookupKey`

### 9.3 `GET /v1/recipients/:recipientId`

Purpose:

- fetch one recipient

### 9.4 `POST /v1/recipients/:recipientId/claim`

Purpose:

- upgrade a pending recipient into a claimed user recipient

Request:

```json
{
  "email": "alice@gmail.com",
  "privyUserId": "did:privy:usr_123",
  "walletAddress": "0xabc..."
}
```

`walletAddress` should remain optional if Privy provisioning is enabled.

### 9.5 Future recipient endpoints

- `POST /v1/recipients/invite`
- `POST /v1/recipients/:recipientId/send-claim`
- `POST /v1/recipients/:recipientId/resend-notification`

## 10. Envelope API

### 10.1 `POST /v1/envelopes`

Purpose:

- create a policy envelope

Request:

```json
{
  "id": "env_payroll",
  "asset": "USDC",
  "maxAmountPerTx": "2000",
  "maxAmountPerDay": "10000",
  "allowedRecipientIds": ["rcp_alice"],
  "schedule": {
    "days": ["mon", "fri"],
    "startHourUtc": 9,
    "endHourUtc": 18
  }
}
```

### 10.2 `GET /v1/envelopes`

### 10.3 `GET /v1/envelopes/:envelopeId`

### 10.4 `PATCH /v1/envelopes/:envelopeId`

### 10.5 `POST /v1/envelopes/:envelopeId/evaluate`

Purpose:

- dry-run an intent against an envelope

## 11. Intent API

### 11.1 `POST /v1/intents`

Purpose:

- create a payment intent

### 11.2 `GET /v1/intents`

### 11.3 `GET /v1/intents/:intentId`

### 11.4 Future intent endpoints

- `POST /v1/intents/:intentId/approve`
- `POST /v1/intents/:intentId/reject`

## 12. Payment API

### 12.1 `POST /v1/payments`

Purpose:

- create a payment record and settlement plan

Request:

```json
{
  "intentId": "intent_1",
  "amount": "50.00",
  "asset": "USDC",
  "recipient": {
    "id": "rcp_alice",
    "ownerType": "user",
    "ownerId": "usr_alice",
    "walletAddress": "0x1111111111111111111111111111111111111111",
    "claimStatus": "claimed",
    "lookupKey": "alice@gmail.com"
  }
}
```

### 12.2 `GET /v1/payments`

Suggested filters:

- `status`
- `recipientId`
- `intentId`

### 12.3 `GET /v1/payments/:paymentId`

### 12.4 `POST /v1/payments/:paymentId/execute`

Purpose:

- run the synchronous execution path where available

### 12.5 `POST /v1/payments/:paymentId/execute-async`

Purpose:

- trigger async Arc settlement

### 12.6 `POST /v1/payments/:paymentId/claim`

Purpose:

- complete payout for a claimable payment

Request:

```json
{
  "walletAddress": "0x3333333333333333333333333333333333333333"
}
```

## 13. Settlement API

These endpoints should be added once settlement records are persistent.

### 13.1 `GET /v1/settlements`

### 13.2 `GET /v1/settlements/:settlementId`

### 13.3 `POST /v1/settlements/:settlementId/replay`

### 13.4 `POST /v1/payments/:paymentId/reconcile`

## 14. Notification API

### 14.1 `GET /v1/notifications`

Suggested filters:

- `recipient`
- `channel`
- `type`
- `deliveryStatus`

### 14.2 Future notification endpoints

- `POST /v1/notifications/:notificationId/retry`
- `GET /v1/notifications/:notificationId`

## 15. Ledger API

Add only after ledger implementation is in place.

### 15.1 `GET /v1/ledger/accounts/:accountId`

### 15.2 `GET /v1/ledger/accounts/:accountId/entries`

### 15.3 `GET /v1/ledger/references/:referenceType/:referenceId`

## 16. Webhooks

Webhook event types should mirror core domain events:

- `recipient.claimed`
- `payment.created`
- `payment.pending_claim`
- `payment.settled`
- `payment.claimed`
- `payment.failed`
- `notification.sent`
- `notification.failed`

Webhook payload shape:

```json
{
  "id": "evt_123",
  "type": "payment.settled",
  "createdAt": "2026-04-12T00:00:00.000Z",
  "data": {}
}
```

## 17. Idempotency

Mutation endpoints should honor `Idempotency-Key`.

At minimum:

- `POST /v1/recipients/:recipientId/claim`
- `POST /v1/envelopes`
- `POST /v1/intents`
- `POST /v1/payments`
- `POST /v1/payments/:paymentId/execute-async`

Idempotency records should be persistent and scoped by endpoint plus authenticated principal.

## 18. Pagination

List endpoints should move to cursor pagination.

Response example:

```json
{
  "data": [],
  "page": {
    "nextCursor": "cursor_123"
  }
}
```

## 19. Validation

Every endpoint should validate:

- required fields
- mutually exclusive recipient selectors
- enum values
- amount format
- address format
- ID format

Recommended approach:

- `zod` request schemas
- centralized validation error formatter

## 20. Authorization

Initial authorization model:

- operator API keys
- org-scoped API keys

Future authorization model:

- user auth for console
- role-based org permissions
- envelope-scoped action permissions

## 21. Implementation Order

Implement the stable REST contract in this order:

1. health
2. recipients
3. envelopes
4. intents
5. payments
6. notifications
7. settlements
8. ledger

## 22. Exit Criteria

The REST API is ready when:

- endpoints are versioned
- request and response schemas are explicit
- auth and idempotency exist
- pagination exists
- SDK can be generated or hand-maintained against the contract
