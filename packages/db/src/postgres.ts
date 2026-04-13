import type {
  IdentityRepository,
  IdentityState,
  UserRecord
} from "../../identity/src/index.ts";
import type { ResolvedRecipient } from "../../recipient-resolution/src/index.ts";
import type { Envelope } from "../../policy-engine/src/index.ts";
import type { PaymentIntentRecord } from "../../intents/src/index.ts";
import type { PersistedPaymentState } from "../../payments/src/index.ts";
import type { NotificationEvent } from "../../notifications/src/index.ts";
import type { SettlementRecord } from "../../settlement/src/index.ts";
import type { LedgerEntry } from "../../ledger/src/index.ts";
import type { AuditEvent } from "../../audit/src/index.ts";
import type { WorkerJob } from "../../../apps/worker/src/index.ts";

export type SqlQueryResult = {
  rows: Array<Record<string, unknown>>;
};

export type SqlClient = {
  query: (sql: string, params?: unknown[]) => Promise<SqlQueryResult>;
};

export type AppState = {
  envelopes: Envelope[];
  intents: PaymentIntentRecord[];
  payments: PersistedPaymentState[];
  notifications: NotificationEvent[];
  settlements: SettlementRecord[];
  ledgerEntries: LedgerEntry[];
  auditEvents: AuditEvent[];
  workerJobs: WorkerJob[];
};

export type AppStateRepository = {
  loadAppState: () => Promise<AppState>;
  upsertEnvelope: (envelope: Envelope) => Promise<void>;
  upsertIntent: (intent: PaymentIntentRecord) => Promise<void>;
  upsertPaymentState: (entry: PersistedPaymentState) => Promise<void>;
  upsertNotification: (event: NotificationEvent) => Promise<void>;
  upsertSettlement: (record: SettlementRecord) => Promise<void>;
  upsertLedgerEntry: (entry: LedgerEntry) => Promise<void>;
  upsertAuditEvent: (event: AuditEvent) => Promise<void>;
  upsertWorkerJob: (job: WorkerJob) => Promise<void>;
};

export type PostgresAppRepository = IdentityRepository & AppStateRepository;

const mapUserRow = (row: Record<string, unknown>): UserRecord => ({
  id: String(row.id),
  email: String(row.email),
  privyUserId: String(row.privy_user_id),
  walletAddress:
    typeof row.wallet_address === "string" ? row.wallet_address : undefined
});

const mapRecipientRow = (row: Record<string, unknown>): ResolvedRecipient => ({
  id: String(row.id),
  lookupKey: String(row.lookup_key),
  ownerType: row.owner_type as ResolvedRecipient["ownerType"],
  ownerId: typeof row.owner_id === "string" ? row.owner_id : undefined,
  walletAddress:
    typeof row.wallet_address === "string" ? row.wallet_address : undefined,
  claimStatus: row.claim_status as ResolvedRecipient["claimStatus"]
});

const parseJsonColumn = <T>(value: unknown): T => {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value as T;
};

export const createPostgresIdentityRepository = ({
  client
}: {
  client: SqlClient;
}): IdentityRepository => ({
  async load(): Promise<IdentityState> {
    const [users, recipients] = await Promise.all([
      client.query(
        "select id, email, privy_user_id, wallet_address from users order by created_at asc"
      ),
      client.query(
        "select id, lookup_key, owner_type, owner_id, wallet_address, claim_status from recipients order by created_at asc"
      )
    ]);

    return {
      users: users.rows.map(mapUserRow),
      recipients: recipients.rows.map(mapRecipientRow)
    };
  },
  async upsertUser(user) {
    await client.query(
      `insert into users (id, email, privy_user_id, wallet_address)
       values ($1, $2, $3, $4)
       on conflict (id) do update
       set email = excluded.email,
           privy_user_id = excluded.privy_user_id,
           wallet_address = excluded.wallet_address,
           updated_at = now()`,
      [user.id, user.email, user.privyUserId, user.walletAddress ?? null]
    );
  },
  async upsertRecipient(recipient) {
    await client.query(
      `insert into recipients (id, lookup_key, owner_type, owner_id, wallet_address, claim_status)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update
       set lookup_key = excluded.lookup_key,
           owner_type = excluded.owner_type,
           owner_id = excluded.owner_id,
           wallet_address = excluded.wallet_address,
           claim_status = excluded.claim_status,
           updated_at = now()`,
      [
        recipient.id,
        recipient.lookupKey,
        recipient.ownerType,
        recipient.ownerId ?? null,
        recipient.walletAddress ?? null,
        recipient.claimStatus
      ]
    );
  }
});

export const createPostgresAppRepository = ({
  client
}: {
  client: SqlClient;
}): PostgresAppRepository => ({
  ...createPostgresIdentityRepository({ client }),
  async loadAppState(): Promise<AppState> {
    const [envelopes, intents, payments, notifications, settlements, ledgerEntries, auditEvents, workerJobs] = await Promise.all([
      client.query("select data from envelopes order by created_at asc"),
      client.query("select data from intents order by created_at asc"),
      client.query(
        "select payment_data, settlement_data from payments order by created_at asc"
      ),
      client.query("select data from notifications order by created_at asc"),
      client.query("select data from settlements order by created_at asc"),
      client.query("select data from ledger_entries order by created_at asc"),
      client.query("select data from audit_events order by created_at asc"),
      client.query("select data from worker_jobs order by created_at asc")
    ]);

    return {
      envelopes: envelopes.rows.map((row) => parseJsonColumn<Envelope>(row.data)),
      intents: intents.rows.map((row) =>
        parseJsonColumn<PaymentIntentRecord>(row.data)
      ),
      payments: payments.rows.map((row) => ({
        payment: parseJsonColumn<PersistedPaymentState["payment"]>(row.payment_data),
        settlement: parseJsonColumn<PersistedPaymentState["settlement"]>(
          row.settlement_data
        )
      })),
      notifications: notifications.rows.map((row) =>
        parseJsonColumn<NotificationEvent>(row.data)
      ),
      settlements: settlements.rows.map((row) =>
        parseJsonColumn<SettlementRecord>(row.data)
      ),
      ledgerEntries: ledgerEntries.rows.map((row) =>
        parseJsonColumn<LedgerEntry>(row.data)
      ),
      auditEvents: auditEvents.rows.map((row) =>
        parseJsonColumn<AuditEvent>(row.data)
      ),
      workerJobs: workerJobs.rows.map((row) =>
        parseJsonColumn<WorkerJob>(row.data)
      )
    };
  },
  async upsertEnvelope(envelope) {
    await client.query(
      `insert into envelopes (id, data)
       values ($1, $2::jsonb)
       on conflict (id) do update
       set data = excluded.data,
           updated_at = now()`,
      [envelope.id, JSON.stringify(envelope)]
    );
  },
  async upsertIntent(intent) {
    await client.query(
      `insert into intents (id, envelope_id, recipient_id, status, data)
       values ($1, $2, $3, $4, $5::jsonb)
       on conflict (id) do update
       set envelope_id = excluded.envelope_id,
           recipient_id = excluded.recipient_id,
           status = excluded.status,
           data = excluded.data,
           updated_at = now()`,
      [
        intent.id,
        intent.envelopeId,
        intent.recipientId,
        intent.status,
        JSON.stringify(intent)
      ]
    );
  },
  async upsertPaymentState(entry) {
    await client.query(
      `insert into payments (id, intent_id, recipient_id, status, payment_data, settlement_data)
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
       on conflict (id) do update
       set intent_id = excluded.intent_id,
           recipient_id = excluded.recipient_id,
           status = excluded.status,
           payment_data = excluded.payment_data,
           settlement_data = excluded.settlement_data,
           updated_at = now()`,
      [
        entry.payment.id,
        entry.payment.intentId,
        entry.payment.recipientId,
        entry.payment.status,
        JSON.stringify(entry.payment),
        JSON.stringify(entry.settlement)
      ]
    );
  },
  async upsertNotification(event) {
    const id = event.id ?? `ntf_${Date.now()}`;
    await client.query(
      `insert into notifications (id, type, channel, recipient, data)
       values ($1, $2, $3, $4, $5::jsonb)
       on conflict (id) do update
       set type = excluded.type,
           channel = excluded.channel,
           recipient = excluded.recipient,
           data = excluded.data,
           updated_at = now()`,
      [id, event.type, event.channel, event.recipient, JSON.stringify({ ...event, id })]
    );
  },
  async upsertSettlement(record) {
    await client.query(
      `insert into settlements (id, payment_id, status, mode, chain, data)
       values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict (id) do update
       set payment_id = excluded.payment_id,
           status = excluded.status,
           mode = excluded.mode,
           chain = excluded.chain,
           data = excluded.data,
           updated_at = now()`,
      [
        record.id,
        record.paymentId,
        record.status,
        record.mode,
        record.chain,
        JSON.stringify(record)
      ]
    );
  },
  async upsertLedgerEntry(entry) {
    await client.query(
      `insert into ledger_entries (id, account_id, entry_type, reference_type, reference_id, data)
       values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict (id) do update
       set account_id = excluded.account_id,
           entry_type = excluded.entry_type,
           reference_type = excluded.reference_type,
           reference_id = excluded.reference_id,
           data = excluded.data,
           updated_at = now()`,
      [
        entry.id,
        entry.accountId,
        entry.entryType,
        entry.referenceType,
        entry.referenceId,
        JSON.stringify(entry)
      ]
    );
  },
  async upsertAuditEvent(event) {
    await client.query(
      `insert into audit_events (id, actor_type, actor_id, event_type, object_type, object_id, data)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)
       on conflict (id) do update
       set actor_type = excluded.actor_type,
           actor_id = excluded.actor_id,
           event_type = excluded.event_type,
           object_type = excluded.object_type,
           object_id = excluded.object_id,
           data = excluded.data,
           updated_at = now()`,
      [
        event.id,
        event.actorType,
        event.actorId,
        event.eventType,
        event.objectType,
        event.objectId,
        JSON.stringify(event)
      ]
    );
  },
  async upsertWorkerJob(job) {
    await client.query(
      `insert into worker_jobs (id, job_type, payment_id, settlement_id, status, data)
       values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict (id) do update
       set job_type = excluded.job_type,
           payment_id = excluded.payment_id,
           settlement_id = excluded.settlement_id,
           status = excluded.status,
           data = excluded.data,
           updated_at = now()`,
      [
        job.id,
        job.type,
        job.paymentId,
        job.settlementId,
        job.status,
        JSON.stringify(job)
      ]
    );
  }
});

export const createNodePostgresClient = async ({
  connectionString
}: {
  connectionString: string;
}): Promise<SqlClient> => {
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier)"
  ) as (specifier: string) => Promise<unknown>;
  const pg = (await dynamicImport("pg")) as {
    Client: new (options: { connectionString: string }) => {
      connect: () => Promise<void>;
      query: SqlClient["query"];
    };
  };

  const client = new pg.Client({ connectionString });
  await client.connect();

  return {
    query: client.query.bind(client)
  };
};
