# Microcosm Postgres Migration Plan

## 1. Purpose

This document describes how Microcosm should evolve from the current initial schema into a durable, migration-driven Postgres model.

The goal is not just to add tables. The goal is to create a migration strategy that preserves:

- backward compatibility
- operator safety
- auditability
- replayability
- deploy-time predictability

## 2. Current State

The current baseline schema includes:

- `users`
- `organizations`
- `agents`
- `wallets`
- `recipients`

That schema is useful, but it is not yet enough to support:

- durable payment lifecycle tracking
- settlement reconciliation
- notifications
- ledger accounting
- audit history
- versioned envelopes

## 3. Migration Principles

- all schema changes must be forward-migratable
- production migrations must be additive first whenever possible
- destructive changes should be delayed until backfills are complete
- each migration should be small, reviewable, and reversible in effect
- application code should tolerate both pre- and post-migration states during rollout when needed

## 4. Migration Tooling

Recommended approach:

- SQL-first migration files under `packages/db/migrations`
- one migration file per logical schema change
- metadata table for applied migrations

Suggested structure:

- `packages/db/migrations/0001_initial.sql`
- `packages/db/migrations/0002_envelopes.sql`
- `packages/db/migrations/0003_intents.sql`
- `packages/db/migrations/0004_payments.sql`
- `packages/db/migrations/0005_settlements.sql`
- `packages/db/migrations/0006_notifications.sql`
- `packages/db/migrations/0007_ledger.sql`
- `packages/db/migrations/0008_audit_events.sql`

Recommended commands:

- `npm run db:apply-schema`
- `npm run db:migrate`
- `npm run db:status`
- `npm run db:reset`

## 5. Target Domain Tables

The full target relational model should include:

### Identity and Ownership

- `users`
- `organizations`
- `agents`
- `wallets`
- `recipients`

### Policy and Payment Flow

- `envelopes`
- `envelope_versions`
- `intents`
- `intent_approvals`
- `payments`
- `settlements`

### Delivery and Audit

- `notifications`
- `notification_attempts`
- `audit_events`

### Financial Core

- `ledger_accounts`
- `ledger_entries`

### Operational Support

- `idempotency_keys`
- `webhook_deliveries`

## 6. Detailed Migration Sequence

## Migration 0001: Initial Identity Schema

Already conceptually exists.

Tables:

- `users`
- `organizations`
- `agents`
- `wallets`
- `recipients`

Keep this as the base migration.

## Migration 0002: Envelopes

Add:

- `envelopes`
- `envelope_versions`

Recommended columns for `envelopes`:

- `id`
- `organization_id`
- `status`
- `active_version_id`
- `created_at`
- `updated_at`

Recommended columns for `envelope_versions`:

- `id`
- `envelope_id`
- `version`
- `rules_json`
- `created_by`
- `created_at`

Reason:

- envelopes need versioning
- rules should be immutable per version

## Migration 0003: Intents

Add:

- `intents`
- `intent_approvals`

Recommended columns for `intents`:

- `id`
- `type`
- `envelope_id`
- `recipient_id`
- `amount`
- `asset`
- `status`
- `evaluation_json`
- `executed_at`
- `spent_today`
- `created_at`
- `updated_at`

Recommended columns for `intent_approvals`:

- `id`
- `intent_id`
- `approver_type`
- `approver_id`
- `decision`
- `reason`
- `created_at`

## Migration 0004: Payments

Add:

- `payments`

Recommended columns:

- `id`
- `intent_id`
- `recipient_id`
- `amount`
- `asset`
- `status`
- `settlement_mode`
- `source_wallet_id`
- `destination_wallet_address`
- `created_at`
- `updated_at`

Add indexes:

- `payments_intent_id_idx`
- `payments_recipient_id_idx`
- `payments_status_idx`

## Migration 0005: Settlements

Add:

- `settlements`

Recommended columns:

- `id`
- `payment_id`
- `chain`
- `mode`
- `tx_hash`
- `escrow_id`
- `status`
- `submitted_at`
- `finalized_at`
- `raw_result_json`
- `created_at`
- `updated_at`

Add uniqueness:

- unique `tx_hash` where not null

## Migration 0006: Notifications

Add:

- `notifications`
- `notification_attempts`

Recommended columns for `notifications`:

- `id`
- `type`
- `channel`
- `recipient`
- `payload_json`
- `delivery_status`
- `created_at`
- `updated_at`

Recommended columns for `notification_attempts`:

- `id`
- `notification_id`
- `attempt_number`
- `status`
- `provider_response_json`
- `created_at`

## Migration 0007: Ledger

Add:

- `ledger_accounts`
- `ledger_entries`

Recommended columns for `ledger_accounts`:

- `id`
- `owner_type`
- `owner_id`
- `asset`
- `kind`
- `created_at`

Recommended columns for `ledger_entries`:

- `id`
- `account_id`
- `direction`
- `amount`
- `asset`
- `reference_type`
- `reference_id`
- `created_at`

Rules:

- entries should be append-only
- balance should be derived from entries, not stored as mutable truth

## Migration 0008: Audit Events

Add:

- `audit_events`

Recommended columns:

- `id`
- `actor_type`
- `actor_id`
- `event_type`
- `object_type`
- `object_id`
- `payload_json`
- `created_at`

## Migration 0009: Idempotency Keys

Add:

- `idempotency_keys`

Recommended columns:

- `id`
- `scope`
- `idempotency_key`
- `request_hash`
- `response_json`
- `created_at`
- `expires_at`

Purpose:

- make mutation endpoints safe under retries

## Migration 0010: Webhook Deliveries

Add:

- `webhook_deliveries`

Purpose:

- reliable downstream event delivery

## 7. Schema Conventions

Use these conventions consistently:

- `text` IDs for application-level IDs
- `jsonb` for rule payloads and raw provider responses
- `timestamptz` for all timestamps
- `created_at` and `updated_at` on mutable records
- append-only design for financial and audit records

## 8. Foreign Key Strategy

Use foreign keys where ownership is stable and lifecycle coupling is real.

Recommended:

- `agents.organization_id -> organizations.id`
- `wallets.owner_id` should remain application-enforced where owner type varies
- `envelope_versions.envelope_id -> envelopes.id`
- `intents.envelope_id -> envelopes.id`
- `payments.intent_id -> intents.id`
- `settlements.payment_id -> payments.id`
- `notification_attempts.notification_id -> notifications.id`
- `ledger_entries.account_id -> ledger_accounts.id`

Do not overuse polymorphic foreign keys where Postgres cannot enforce them cleanly.

## 9. Indexing Plan

Initial critical indexes:

- `users_email_idx`
- `users_privy_user_id_idx`
- `recipients_lookup_key_idx`
- `recipients_owner_idx`
- `payments_status_idx`
- `payments_recipient_id_idx`
- `settlements_payment_id_idx`
- `settlements_tx_hash_idx`
- `notifications_recipient_idx`
- `audit_events_object_idx`
- `ledger_entries_account_id_idx`

Add indexes only when query patterns justify them.

## 10. Backfill Strategy

Every nontrivial migration should specify whether it needs:

- no backfill
- synchronous migration-time backfill
- async background backfill

Examples:

### Safe synchronous backfill

- populate a new nullable derived column on a small table

### Async backfill

- generating historical settlement rows from existing payment records
- moving notification history into a new attempts table

## 11. Rollout Strategy

For additive schema changes:

1. add new tables/columns
2. deploy code that writes both old and new shapes if needed
3. backfill
4. switch readers
5. remove legacy paths later

For high-risk changes:

- separate migration release from behavior change release

## 12. Local Development Plan

On a developer machine, migration workflow should be:

```bash
npm run db:apply-schema
npm run db:migrate
npm run db:seed
```

For destructive resets:

```bash
npm run db:reset
npm run db:apply-schema
npm run db:seed
```

## 13. Testing Plan

Each migration series should have:

- repository tests
- migration smoke tests
- rollback or downgrade awareness where relevant
- startup readiness tests

For risky migrations, add:

- before/after fixture snapshots
- integration tests over migrated data

## 14. Exit Criteria

The migration system is ready when:

- schema evolution is file-based and repeatable
- every runtime domain has a repository-backed table set
- startup can verify schema presence
- migrations are runnable locally and in deployment
- repository tests pass against the migrated schema
