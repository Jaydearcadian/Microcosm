import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import type {
  IdentityRepository,
  IdentityState,
  UserRecord,
  ExternalIdentity,
  IdentityResolution,
  WalletLinkChallenge
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
import type {
  Space,
  SpaceMembership,
  SpaceService
} from "../../spaces/src/index.ts";

export type SqlQueryResult = {
  rows: Array<Record<string, unknown>>;
};

export type SqlClient = {
  query: (sql: string, params?: unknown[]) => Promise<SqlQueryResult>;
  transaction?: <T>(fn: (tx: SqlClient) => Promise<T>) => Promise<T>;
  close?: () => Promise<void>;
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

export type IdempotencyRecord = {
  key: string;
  principalId: string;
  route: string;
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
  createdAt: string;
};

export type AppStateRepository = {
  loadAppState: () => Promise<AppState>;
  upsertEnvelope: (envelope: Envelope) => Promise<void>;
  upsertIntent: (intent: PaymentIntentRecord) => Promise<void>;
  saveIntentWithAudit?: (
    intent: PaymentIntentRecord,
    auditEvent: AuditEvent
  ) => Promise<void>;
  upsertPaymentState: (entry: PersistedPaymentState) => Promise<void>;
  updatePaymentTransition?: (
    paymentId: string,
    expectedStatus: string,
    newStatus: string,
    txHash?: string
  ) => Promise<boolean>;
  upsertNotification: (event: NotificationEvent) => Promise<void>;
  upsertSettlement: (record: SettlementRecord) => Promise<void>;
  upsertLedgerEntry: (entry: LedgerEntry) => Promise<void>;
  upsertAuditEvent: (event: AuditEvent) => Promise<void>;
  upsertWorkerJob: (job: WorkerJob) => Promise<void>;
  claimNextWorkerJob?: (
    leaseOwner: string,
    leaseTimeoutMs?: number
  ) => Promise<WorkerJob | undefined>;
  completeWorkerJob?: (
    jobId: string,
    result?: Record<string, unknown>
  ) => Promise<void>;
  getIdempotencyRecord?: (
    principalId: string,
    route: string,
    key: string
  ) => Promise<IdempotencyRecord | undefined>;
  saveIdempotencyRecord?: (record: IdempotencyRecord) => Promise<void>;
  getEnvelope?: (id: string, spaceId: string) => Promise<Envelope | undefined>;
  listEnvelopes?: (spaceId: string) => Promise<Envelope[]>;
  getIntent?: (id: string, spaceId: string) => Promise<PaymentIntentRecord | undefined>;
  listIntents?: (spaceId: string) => Promise<PaymentIntentRecord[]>;
  getPayment?: (id: string, spaceId: string) => Promise<PersistedPaymentState | undefined>;
  listPayments?: (spaceId: string) => Promise<PersistedPaymentState[]>;
  listAuditEvents?: (spaceId: string) => Promise<AuditEvent[]>;
  listRecipients?: (spaceId: string) => Promise<ResolvedRecipient[]>;
};

export type PostgresAppRepository = IdentityRepository & AppStateRepository;
export type PostgresSpaceService = SpaceService;

const mapUserRow = (row: Record<string, unknown>): UserRecord => ({
  id: String(row.id),
  email: row.email ? String(row.email) : "",
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
  claimStatus: row.claim_status as ResolvedRecipient["claimStatus"],
  spaceId: typeof row.space_id === "string" ? row.space_id : undefined
});

const parseJsonColumn = <T>(value: unknown): T => {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value as T;
};

export const applyPostgresSchema = async (client: SqlClient): Promise<void> => {
  const schemaSql = readFileSync(
    new URL("../postgres/schema.sql", import.meta.url),
    "utf8"
  );
  await client.query(schemaSql);
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
        "select id, lookup_key, owner_type, owner_id, wallet_address, claim_status, space_id from recipients order by created_at asc"
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
      [user.id, user.email || null, user.privyUserId, user.walletAddress ?? null]
    );
  },
  async upsertRecipient(recipient) {
    await client.query(
      `insert into recipients (id, lookup_key, owner_type, owner_id, wallet_address, claim_status, space_id)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (id) do update
       set lookup_key = excluded.lookup_key,
           owner_type = excluded.owner_type,
           owner_id = excluded.owner_id,
           wallet_address = excluded.wallet_address,
           claim_status = excluded.claim_status,
           space_id = coalesce(excluded.space_id, recipients.space_id),
           updated_at = now()`,
      [
        recipient.id,
        recipient.lookupKey,
        recipient.ownerType,
        recipient.ownerId ?? null,
        recipient.walletAddress ?? null,
        recipient.claimStatus,
        recipient.spaceId ?? null
      ]
    );
  },
  async resolveOrCreatePrincipal(input: {
    externalIdentity: ExternalIdentity;
    email?: string;
  }): Promise<IdentityResolution> {
    const normEmail = input.email ? input.email.trim().toLowerCase() : null;
    const newUserId = `usr_${randomBytes(8).toString("hex")}`;
    const now = new Date().toISOString();

    const res = await client.query(
      `insert into users (id, email, privy_user_id, created_at, updated_at)
       values ($1, $2, $3, $4, $4)
       on conflict (privy_user_id) do update
       set email = coalesce(nullif($2, ''), users.email),
           updated_at = now()
       returning id, email, privy_user_id, wallet_address, (xmax = 0) as inserted`,
      [newUserId, normEmail, input.externalIdentity.subject, now]
    );

    const row = res.rows[0]!;
    const user: UserRecord = {
      id: String(row.id),
      email: row.email ? String(row.email) : "",
      privyUserId: String(row.privy_user_id),
      walletAddress:
        typeof row.wallet_address === "string" ? row.wallet_address : undefined
    };

    return {
      user,
      created: Boolean(row.inserted)
    };
  },
  async saveWalletLinkChallenge(challenge: WalletLinkChallenge): Promise<void> {
    await client.query(
      `insert into wallet_link_challenges (id, user_id, space_id, address, nonce, message, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        challenge.id,
        challenge.userId,
        challenge.spaceId,
        challenge.address,
        challenge.nonce,
        challenge.message,
        challenge.expiresAt
      ]
    );
  },
  async consumeWalletLinkChallenge(challengeId: string): Promise<boolean> {
    const res = await client.query(
      `update wallet_link_challenges
       set consumed_at = now()
       where id = $1 and consumed_at is null and expires_at > now()
       returning id`,
      [challengeId]
    );
    return res.rows.length === 1;
  },
  async getWalletLinkChallenge(
    challengeId: string
  ): Promise<WalletLinkChallenge | undefined> {
    const res = await client.query(
      `select id, user_id, space_id, address, nonce, message, expires_at
       from wallet_link_challenges
       where id = $1`,
      [challengeId]
    );
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0]!;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      spaceId: String(row.space_id),
      address: String(row.address) as `0x${string}`,
      nonce: String(row.nonce),
      message: String(row.message),
      expiresAt: new Date(row.expires_at as string).toISOString()
    };
  }
});

export const createPostgresSpaceService = ({
  client
}: {
  client: SqlClient;
}): PostgresSpaceService => ({
  async ensurePersonalSpace(userId: string): Promise<Space> {
    const now = new Date().toISOString();
    const spaceId = `spc_${randomBytes(8).toString("hex")}`;

    const res = await client.query(
      `insert into spaces (id, type, name, owner_user_id, status, created_at, updated_at)
       values ($1, 'personal', 'Personal Space', $2, 'active', $3, $3)
       on conflict (owner_user_id) where type = 'personal'
       do update set updated_at = now()
       returning id, type, name, owner_user_id, status, created_at, updated_at`,
      [spaceId, userId, now]
    );

    const row = res.rows[0]!;
    const space: Space = {
      id: String(row.id),
      type: row.type as "personal",
      name: String(row.name),
      ownerUserId: String(row.owner_user_id),
      status: row.status as "active",
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString()
    };

    await client.query(
      `insert into space_memberships (space_id, user_id, role, status, created_at)
       values ($1, $2, 'owner', 'active', $3)
       on conflict (space_id, user_id) do nothing`,
      [space.id, userId, now]
    );

    return space;
  },

  async getSpace(spaceId: string): Promise<Space | undefined> {
    const res = await client.query(
      `select id, type, name, owner_user_id, status, created_at, updated_at
       from spaces where id = $1`,
      [spaceId]
    );
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0]!;
    return {
      id: String(row.id),
      type: row.type as "personal" | "shared",
      name: String(row.name),
      ownerUserId: String(row.owner_user_id),
      status: row.status as "active" | "suspended" | "archived",
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString()
    };
  },

  async listSpacesForUser(userId: string): Promise<Space[]> {
    const res = await client.query(
      `select s.id, s.type, s.name, s.owner_user_id, s.status, s.created_at, s.updated_at
       from spaces s
       join space_memberships m on m.space_id = s.id
       where m.user_id = $1 and m.status = 'active'`,
      [userId]
    );
    return res.rows.map((row) => ({
      id: String(row.id),
      type: row.type as "personal" | "shared",
      name: String(row.name),
      ownerUserId: String(row.owner_user_id),
      status: row.status as "active" | "suspended" | "archived",
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString()
    }));
  },

  async requireActiveMembership(
    userId: string,
    spaceId: string
  ): Promise<SpaceMembership> {
    const res = await client.query(
      `select space_id, user_id, role, status, created_at
       from space_memberships
       where space_id = $1 and user_id = $2`,
      [spaceId, userId]
    );
    if (res.rows.length === 0 || res.rows[0]!.status !== "active") {
      throw new Error(
        `Active membership in space ${spaceId} required for user ${userId}`
      );
    }
    const row = res.rows[0]!;
    return {
      spaceId: String(row.space_id),
      userId: String(row.user_id),
      role: row.role as SpaceMembership["role"],
      status: row.status as SpaceMembership["status"],
      createdAt: new Date(row.created_at as string).toISOString()
    };
  },

  async assertSpaceOwnership(userId: string, spaceId: string): Promise<void> {
    const res = await client.query(
      `select owner_user_id from spaces where id = $1`,
      [spaceId]
    );
    if (res.rows.length === 0 || res.rows[0]!.owner_user_id !== userId) {
      throw new Error(`Ownership of space ${spaceId} required for user ${userId}`);
    }
  },

  async revokeMembership(userId: string, spaceId: string): Promise<void> {
    await client.query(
      `update space_memberships set status = 'revoked'
       where space_id = $1 and user_id = $2`,
      [spaceId, userId]
    );
  },

  async createSpace(
    userId: string,
    input: { name: string; type?: "personal" | "shared" }
  ): Promise<Space> {
    const now = new Date().toISOString();
    const spaceId = `spc_${randomBytes(8).toString("hex")}`;
    const type = input.type ?? "shared";
    await client.query(
      `insert into spaces (id, type, name, owner_user_id, status, created_at, updated_at)
       values ($1, $2, $3, $4, 'active', $5, $5)`,
      [spaceId, type, input.name, userId, now]
    );
    await client.query(
      `insert into space_memberships (space_id, user_id, role, status, created_at)
       values ($1, $2, 'owner', 'active', $3)`,
      [spaceId, userId, now]
    );
    return {
      id: spaceId,
      type,
      name: input.name,
      ownerUserId: userId,
      status: "active",
      createdAt: now,
      updatedAt: now
    };
  },

  async addMember(input: {
    spaceId: string;
    userId: string;
    role: SpaceMembership["role"];
  }): Promise<SpaceMembership> {
    const now = new Date().toISOString();
    await client.query(
      `insert into space_memberships (space_id, user_id, role, status, created_at)
       values ($1, $2, $3, 'active', $4)
       on conflict (space_id, user_id) do update
       set role = excluded.role,
           status = 'active'`,
      [input.spaceId, input.userId, input.role, now]
    );
    return {
      spaceId: input.spaceId,
      userId: input.userId,
      role: input.role,
      status: "active",
      createdAt: now
    };
  },

  async getMembership(
    userId: string,
    spaceId: string
  ): Promise<SpaceMembership | undefined> {
    const res = await client.query(
      `select space_id, user_id, role, status, created_at
       from space_memberships
       where space_id = $1 and user_id = $2`,
      [spaceId, userId]
    );
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0]!;
    return {
      spaceId: String(row.space_id),
      userId: String(row.user_id),
      role: row.role as SpaceMembership["role"],
      status: row.status as SpaceMembership["status"],
      createdAt: new Date(row.created_at as string).toISOString()
    };
  }
});

export const createPostgresAppRepository = ({
  client
}: {
  client: SqlClient;
}): PostgresAppRepository => ({
  ...createPostgresIdentityRepository({ client }),
  async loadAppState(): Promise<AppState> {
    const [
      envelopes,
      intents,
      payments,
      notifications,
      settlements,
      ledgerEntries,
      auditEvents,
      workerJobs
    ] = await Promise.all([
      client.query("select data from envelopes order by created_at asc"),
      client.query("select data from intents order by created_at asc"),
      client.query(
        "select status, tx_hash, payment_data, settlement_data from payments order by created_at asc"
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
      payments: payments.rows.map((row) => {
        const payment = parseJsonColumn<PersistedPaymentState["payment"]>(
          row.payment_data
        );
        if (row.status) {
          payment.status = row.status as any;
        }
        if (row.tx_hash) {
          payment.txHash = String(row.tx_hash);
        }
        return {
          payment,
          settlement: parseJsonColumn<PersistedPaymentState["settlement"]>(
            row.settlement_data
          )
        };
      }),
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
      `insert into envelopes (id, space_id, data)
       values ($1, $2, $3::jsonb)
       on conflict (id) do update
       set space_id = excluded.space_id,
           data = excluded.data,
           updated_at = now()`,
      [envelope.id, envelope.spaceId ?? null, JSON.stringify(envelope)]
    );
  },
  async upsertIntent(intent) {
    await client.query(
      `insert into intents (id, envelope_id, recipient_id, status, space_id, data)
       values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict (id) do update
       set envelope_id = excluded.envelope_id,
           recipient_id = excluded.recipient_id,
           status = excluded.status,
           space_id = excluded.space_id,
           data = excluded.data,
           updated_at = now()`,
      [
        intent.id,
        intent.envelopeId,
        intent.recipientId,
        intent.status,
        intent.spaceId ?? null,
        JSON.stringify(intent)
      ]
    );
  },
  async upsertPaymentState(entry) {
    await client.query(
      `insert into payments (id, intent_id, recipient_id, status, space_id, tx_hash, payment_data, settlement_data)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
       on conflict (id) do update
       set intent_id = excluded.intent_id,
           recipient_id = excluded.recipient_id,
           status = excluded.status,
           space_id = excluded.space_id,
           tx_hash = coalesce(excluded.tx_hash, payments.tx_hash),
           payment_data = excluded.payment_data,
           settlement_data = excluded.settlement_data,
           updated_at = now()`,
      [
        entry.payment.id,
        entry.payment.intentId,
        entry.payment.recipientId,
        entry.payment.status,
        entry.payment.spaceId ?? null,
        entry.payment.txHash ?? null,
        JSON.stringify(entry.payment),
        JSON.stringify(entry.settlement)
      ]
    );
  },
  async updatePaymentTransition(
    paymentId: string,
    expectedStatus: string,
    newStatus: string,
    txHash?: string
  ): Promise<boolean> {
    const res = await client.query(
      `update payments
       set status = $1,
           tx_hash = coalesce($2, tx_hash),
           payment_data = jsonb_set(
             jsonb_set(payment_data, '{status}', to_jsonb($1::text)),
             '{txHash}',
             case when $2 is not null then to_jsonb($2::text) else coalesce(payment_data->'txHash', 'null'::jsonb) end
           ),
           updated_at = now()
       where id = $3 and status = $4
       returning id`,
      [newStatus, txHash ?? null, paymentId, expectedStatus]
    );
    return res.rows.length === 1;
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
      [
        id,
        event.type,
        event.channel,
        event.recipient,
        JSON.stringify({ ...event, id })
      ]
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
      `insert into audit_events (id, actor_type, actor_id, event_type, object_type, object_id, space_id, data)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       on conflict (id) do update
       set actor_type = excluded.actor_type,
           actor_id = excluded.actor_id,
           event_type = excluded.event_type,
           object_type = excluded.object_type,
           object_id = excluded.object_id,
           space_id = excluded.space_id,
           data = excluded.data,
           updated_at = now()`,
      [
        event.id,
        event.actorType,
        event.actorId,
        event.eventType,
        event.objectType,
        event.objectId,
        event.spaceId ?? null,
        JSON.stringify(event)
      ]
    );
  },
  async saveIntentWithAudit(intent, auditEvent) {
    const insertIntent = async (clientOrTx: SqlClient) => {
      await clientOrTx.query(
        `insert into intents (id, envelope_id, recipient_id, status, space_id, data)
         values ($1, $2, $3, $4, $5, $6::jsonb)
         on conflict (id) do update
         set envelope_id = excluded.envelope_id,
             recipient_id = excluded.recipient_id,
             status = excluded.status,
             space_id = excluded.space_id,
             data = excluded.data,
             updated_at = now()`,
        [
          intent.id,
          intent.envelopeId,
          intent.recipientId,
          intent.status,
          intent.spaceId ?? null,
          JSON.stringify(intent)
        ]
      );
    };

    const insertAudit = async (clientOrTx: SqlClient) => {
      await clientOrTx.query(
        `insert into audit_events (id, actor_type, actor_id, event_type, object_type, object_id, space_id, data)
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         on conflict (id) do update
         set actor_type = excluded.actor_type,
             actor_id = excluded.actor_id,
             event_type = excluded.event_type,
             object_type = excluded.object_type,
             object_id = excluded.object_id,
             space_id = excluded.space_id,
             data = excluded.data,
             updated_at = now()`,
        [
          auditEvent.id,
          auditEvent.actorType,
          auditEvent.actorId,
          auditEvent.eventType,
          auditEvent.objectType,
          auditEvent.objectId,
          auditEvent.spaceId ?? null,
          JSON.stringify(auditEvent)
        ]
      );
    };

    if (client.transaction) {
      await client.transaction(async (tx) => {
        await insertIntent(tx);
        await insertAudit(tx);
      });
    } else {
      await insertIntent(client);
      await insertAudit(client);
    }
  },
  async upsertWorkerJob(job) {
    await client.query(
      `insert into worker_jobs (id, job_type, payment_id, settlement_id, status, lease_owner, leased_at, data)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       on conflict (id) do update
       set job_type = excluded.job_type,
           payment_id = excluded.payment_id,
           settlement_id = excluded.settlement_id,
           status = excluded.status,
           lease_owner = excluded.lease_owner,
           leased_at = excluded.leased_at,
           data = excluded.data,
           updated_at = now()`,
      [
        job.id,
        job.type,
        job.paymentId,
        job.settlementId,
        job.status,
        job.leaseOwner ?? null,
        job.leasedAt ?? null,
        JSON.stringify(job)
      ]
    );
  },
  async claimNextWorkerJob(
    leaseOwner: string,
    leaseTimeoutMs = 5 * 60 * 1000
  ): Promise<WorkerJob | undefined> {
    const cutoff = new Date(Date.now() - leaseTimeoutMs).toISOString();
    const now = new Date().toISOString();
    const res = await client.query(
      `with next_job as (
         select id from worker_jobs
         where status = 'queued'
            or (status = 'processing' and (leased_at is null or leased_at < $1::timestamptz))
         order by created_at asc
         limit 1
         for update skip locked
       )
       update worker_jobs
       set status = 'processing',
           lease_owner = $2,
           leased_at = $3::timestamptz,
           updated_at = now()
       from next_job
       where worker_jobs.id = next_job.id
       returning worker_jobs.id, worker_jobs.job_type, worker_jobs.payment_id,
                 worker_jobs.settlement_id, worker_jobs.status, worker_jobs.lease_owner,
                 worker_jobs.leased_at, worker_jobs.data`,
      [cutoff, leaseOwner, now]
    );
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0]!;
    return {
      id: String(row.id),
      type: row.job_type as "settlement.execute",
      paymentId: String(row.payment_id),
      settlementId: String(row.settlement_id),
      status: "processing",
      leaseOwner: String(row.lease_owner),
      leasedAt: new Date(row.leased_at as string).toISOString()
    };
  },
  async completeWorkerJob(jobId: string, result?: Record<string, unknown>): Promise<void> {
    await client.query(
      `update worker_jobs
       set status = 'completed',
           lease_owner = null,
           leased_at = null,
           data = data || $1::jsonb,
           updated_at = now()
       where id = $2`,
      [JSON.stringify({ result: result ?? {} }), jobId]
    );
  },
  async getIdempotencyRecord(
    principalId: string,
    route: string,
    key: string
  ): Promise<IdempotencyRecord | undefined> {
    const res = await client.query(
      `select key, principal_id, route, request_hash, status_code, response_body, created_at
       from idempotency_keys
       where principal_id = $1 and route = $2 and key = $3`,
      [principalId, route, key]
    );
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0]!;
    return {
      key: String(row.key),
      principalId: String(row.principal_id),
      route: String(row.route),
      requestHash: String(row.request_hash),
      statusCode: Number(row.status_code),
      responseBody: parseJsonColumn(row.response_body),
      createdAt: new Date(row.created_at as string).toISOString()
    };
  },
  async saveIdempotencyRecord(record: IdempotencyRecord): Promise<void> {
    await client.query(
      `insert into idempotency_keys (key, principal_id, route, request_hash, status_code, response_body)
       values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict (principal_id, route, key) do update
       set request_hash = excluded.request_hash,
       status_code = excluded.status_code,
       response_body = excluded.response_body`,
      [
        record.key,
        record.principalId,
        record.route,
        record.requestHash,
        record.statusCode,
        JSON.stringify(record.responseBody)
      ]
    );
  },
  async getEnvelope(id: string, spaceId: string): Promise<Envelope | undefined> {
    const res = await client.query(
      "select data from envelopes where id = $1 and space_id = $2",
      [id, spaceId]
    );
    if (res.rows.length === 0) return undefined;
    return parseJsonColumn<Envelope>(res.rows[0]!.data);
  },
  async listEnvelopes(spaceId: string): Promise<Envelope[]> {
    const res = await client.query(
      "select data from envelopes where space_id = $1 order by created_at asc",
      [spaceId]
    );
    return res.rows.map((row) => parseJsonColumn<Envelope>(row.data));
  },
  async getIntent(id: string, spaceId: string): Promise<PaymentIntentRecord | undefined> {
    const res = await client.query(
      "select data from intents where id = $1 and space_id = $2",
      [id, spaceId]
    );
    if (res.rows.length === 0) return undefined;
    return parseJsonColumn<PaymentIntentRecord>(res.rows[0]!.data);
  },
  async listIntents(spaceId: string): Promise<PaymentIntentRecord[]> {
    const res = await client.query(
      "select data from intents where space_id = $1 order by created_at asc",
      [spaceId]
    );
    return res.rows.map((row) => parseJsonColumn<PaymentIntentRecord>(row.data));
  },
  async getPayment(id: string, spaceId: string): Promise<PersistedPaymentState | undefined> {
    const res = await client.query(
      "select status, tx_hash, payment_data, settlement_data from payments where id = $1 and space_id = $2",
      [id, spaceId]
    );
    if (res.rows.length === 0) return undefined;
    const payment = parseJsonColumn<PersistedPaymentState["payment"]>(res.rows[0]!.payment_data);
    if (res.rows[0]!.status) {
      payment.status = res.rows[0]!.status as any;
    }
    if (res.rows[0]!.tx_hash) {
      payment.txHash = String(res.rows[0]!.tx_hash);
    }
    return {
      payment,
      settlement: parseJsonColumn<PersistedPaymentState["settlement"]>(res.rows[0]!.settlement_data)
    };
  },
  async listPayments(spaceId: string): Promise<PersistedPaymentState[]> {
    const res = await client.query(
      "select status, tx_hash, payment_data, settlement_data from payments where space_id = $1 order by created_at asc",
      [spaceId]
    );
    return res.rows.map((row) => {
      const payment = parseJsonColumn<PersistedPaymentState["payment"]>(row.payment_data);
      if (row.status) {
        payment.status = row.status as any;
      }
      if (row.tx_hash) {
        payment.txHash = String(row.tx_hash);
      }
      return {
        payment,
        settlement: parseJsonColumn<PersistedPaymentState["settlement"]>(row.settlement_data)
      };
    });
  },
  async listAuditEvents(spaceId: string): Promise<AuditEvent[]> {
    const res = await client.query(
      "select data from audit_events where space_id = $1 order by created_at asc",
      [spaceId]
    );
    return res.rows.map((row) => parseJsonColumn<AuditEvent>(row.data));
  },
  async listRecipients(spaceId: string): Promise<ResolvedRecipient[]> {
    const res = await client.query(
      "select id, lookup_key, owner_type, owner_id, wallet_address, claim_status, space_id from recipients where space_id = $1 order by created_at asc",
      [spaceId]
    );
    return res.rows.map(mapRecipientRow);
  }
});

export const createNodePostgresClient = async ({
  connectionString
}: {
  connectionString: string;
}): Promise<SqlClient & { close: () => Promise<void> }> => {
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier)"
  ) as (specifier: string) => Promise<unknown>;
  const pg = (await dynamicImport("pg")) as {
    Pool: new (options: { connectionString: string }) => {
      connect: () => Promise<{
        query: (sql: string, params?: unknown[]) => Promise<SqlQueryResult>;
        release: () => void;
      }>;
      query: (sql: string, params?: unknown[]) => Promise<SqlQueryResult>;
      end: () => Promise<void>;
    };
  };

  const pool = new pg.Pool({ connectionString });

  return {
    query: (sql: string, params?: unknown[]) => pool.query(sql, params),
    async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const txClient: SqlClient = {
          query: (sql, params) => client.query(sql, params)
        };
        const result = await fn(txClient);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    }
  };
};
