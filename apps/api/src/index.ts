import { createEnvelopeStore } from "../../../packages/envelopes/src/index.ts";
import { createIntentService } from "../../../packages/intents/src/index.ts";
import { createPaymentService } from "../../../packages/payments/src/index.ts";
import {
  createSettlementConfirmationLoop,
  createArcSettlementExecutor,
  createSettlementStore,
  type SettlementRecord
} from "../../../packages/settlement/src/index.ts";
import {
  type RecipientDirectory,
  type RecipientResolutionInput
} from "../../../packages/recipient-resolution/src/index.ts";
import { createNotificationService } from "../../../packages/notifications/src/index.ts";
import { createJsonStateStore } from "../../../packages/persistence/src/index.ts";
import type { Envelope } from "../../../packages/policy-engine/src/index.ts";
import type { PaymentIntentRecord } from "../../../packages/intents/src/index.ts";
import type { PersistedPaymentState } from "../../../packages/payments/src/index.ts";
import type { NotificationEvent } from "../../../packages/notifications/src/index.ts";
import { createLedgerStore, type LedgerEntry } from "../../../packages/ledger/src/index.ts";
import { createAuditStore, type AuditEvent } from "../../../packages/audit/src/index.ts";
import {
  createWorkerApp,
  type WorkerJob
} from "../../worker/src/index.ts";
import {
  createIdentityService,
  type IdentityProvisioner,
  type IdentityRepository,
  type IdentityState,
  type UserRecord
} from "../../../packages/identity/src/index.ts";
import type { ResolvedRecipient } from "../../../packages/recipient-resolution/src/index.ts";
import {
  createNodePostgresClient,
  createPostgresAppRepository,
  createPostgresSpaceService,
  type AppStateRepository,
  type IdempotencyRecord
} from "../../../packages/db/src/index.ts";
import {
  createPrivyAdapter,
  createPrivyProvisioner
} from "../../../packages/adapters/privy/src/index.ts";
import { createArcContractClient } from "../../../packages/adapters/arc/src/index.ts";
import { createSpaceService, type SpaceService } from "../../../packages/spaces/src/index.ts";

export const apiAppName = "microcosm-api";

type CreateApiAppOptions = {
  directory?: RecipientDirectory;
  persistenceFile?: string;
  notifications?: {
    emailWebhookUrl?: string;
    xmtpWebhookUrl?: string;
    webhookUrl?: string;
  };
  settlement?: {
    privateKey?: string;
    contracts?: {
      settlementRouter?: string;
      claimEscrow?: string;
    };
    submitDirectContractSettlement?: (
      input: {
        contractAddress: string;
        paymentId: string;
        amount: string;
        asset: string;
        destination: string;
      }
    ) => Promise<{ txHash?: string }>;
    confirmer?: (txHash: string) => Promise<{ confirmed: boolean; checkedAt?: string }>;
  };
  identity?: {
    initialState?: Partial<IdentityState>;
    repository?: IdentityRepository & Partial<AppStateRepository>;
    provisioner?: IdentityProvisioner;
  };
  spaces?: SpaceService;
  state?: {
    envelopes?: Envelope[];
    intents?: PaymentIntentRecord[];
    payments?: PersistedPaymentState[];
    notifications?: NotificationEvent[];
    settlements?: SettlementRecord[];
    ledgerEntries?: LedgerEntry[];
    auditEvents?: AuditEvent[];
    workerJobs?: WorkerJob[];
  };
};

export const createApiApp = (
  options: CreateApiAppOptions = {}
) => {
  const notificationOptions = {
    emailWebhookUrl:
      options.notifications?.emailWebhookUrl ?? process.env.EMAIL_WEBHOOK_URL,
    xmtpWebhookUrl:
      options.notifications?.xmtpWebhookUrl ?? process.env.XMTP_WEBHOOK_URL,
    webhookUrl: options.notifications?.webhookUrl ?? process.env.WEBHOOK_URL
  };
  const settlementOptions = {
    privateKey:
      options.settlement?.privateKey ??
      process.env.ARC_SETTLEMENT_PRIVATE_KEY ??
      process.env.PRIVATE_KEY,
    contracts: options.settlement?.contracts,
    submitDirectContractSettlement:
      options.settlement?.submitDirectContractSettlement
  };
  const persistence = options.persistenceFile
    ? createJsonStateStore(options.persistenceFile)
    : undefined;
  const persisted = persistence?.read();
  const envelopes = createEnvelopeStore();
  const intents = createIntentService({ envelopes });
  const settlements = createSettlementStore();
  const ledger = createLedgerStore();
  const audit = createAuditStore();
  const jobs = createWorkerApp({
    settlements: settlements.list,
    jobs: (options.state?.workerJobs ?? persisted?.workerJobs ?? []) as WorkerJob[]
  });
  const identity = createIdentityService({
    directory: options.directory,
    provisioner: options.identity?.provisioner,
    repository: options.identity?.repository
  });
  const spaces = options.spaces ?? createSpaceService();
  const inMemoryIdempotency = new Map<string, IdempotencyRecord>();
  const notifications = createNotificationService(notificationOptions);
  const arcClient =
    settlementOptions.privateKey &&
    (settlementOptions.contracts?.settlementRouter ||
      settlementOptions.contracts?.claimEscrow) &&
    !settlementOptions.submitDirectContractSettlement
      ? createArcContractClient({
          privateKey: settlementOptions.privateKey,
          rpcUrl: process.env.ARC_TESTNET_RPC_URL,
          contracts: settlementOptions.contracts
        })
      : undefined;
  const payments = createPaymentService({
    settlement: createArcSettlementExecutor({
      ...settlementOptions,
      arcClient
    }),
    notifications
  });

  identity.hydrate({
    ...(options.identity?.initialState ?? {}),
    users: (persisted?.users ?? []) as UserRecord[],
    recipients: (persisted?.recipients ?? []) as ResolvedRecipient[]
  });
  envelopes.hydrate(
    (options.state?.envelopes ?? persisted?.envelopes ?? []) as Envelope[]
  );
  intents.hydrate(
    (options.state?.intents ?? persisted?.intents ?? []) as PaymentIntentRecord[]
  );
  payments.hydrate(
    (options.state?.payments ?? persisted?.payments ?? []) as PersistedPaymentState[]
  );
  notifications.hydrate(
    (options.state?.notifications ?? persisted?.notifications ?? []) as NotificationEvent[]
  );
  settlements.hydrate(
    (options.state?.settlements ?? persisted?.settlements ?? []) as SettlementRecord[]
  );
  ledger.hydrate(
    (options.state?.ledgerEntries ?? persisted?.ledgerEntries ?? []) as LedgerEntry[]
  );
  audit.hydrate(
    (options.state?.auditEvents ?? persisted?.auditEvents ?? []) as AuditEvent[]
  );

  const persist = () => {
    if (!persistence) return;
    persistence.write({
      users: identity.listUsers(),
      recipients: identity.listRecipients(),
      envelopes: envelopes.list(),
      intents: intents.list(),
      payments: payments.exportState(),
      notifications: notifications.list(),
      settlements: settlements.list(),
      ledgerEntries: ledger.list(),
      auditEvents: audit.list(),
      workerJobs: jobs.listJobs()
    });
  };

  return {
    resolveRecipient: (input: RecipientResolutionInput) =>
      identity.resolveRecipient(input),
    recipients: {
      resolve(input: RecipientResolutionInput) {
        const recipient = identity.resolveRecipient(input);
        persist();
        return recipient;
      },
      get: identity.getRecipient,
      async claim(
        recipientId: string,
        input: Parameters<typeof identity.claimRecipient>[1]
      ) {
        const recipient = await identity.claimRecipient(recipientId, input);
        persist();
        return recipient;
      },
      create(input: Parameters<NonNullable<typeof identity.createRecipient>>[0]) {
        if (!identity.createRecipient) {
          throw new Error("createRecipient not implemented");
        }
        const recipient = identity.createRecipient(input);
        persist();
        return recipient;
      },
      list: identity.listRecipients
    },
    users: {
      ...identity,
      getByPrivyUserId: identity.getUserByPrivyUserId
    },
    identity,
    envelopes: {
      create(input: Parameters<typeof envelopes.create>[0]) {
        const envelope = envelopes.create(input);
        audit.record({
          id: `aud_envelope_${envelope.id}`,
          actorType: "system",
          actorId: "api",
          eventType: "envelope.created",
          objectType: "envelope",
          objectId: envelope.id,
          payload: { asset: envelope.asset }
        });
        persist();
        return envelope;
      },
      get: envelopes.get,
      list: envelopes.list,
      evaluate: envelopes.evaluate
    },
    intents: {
      create(input: Parameters<typeof intents.create>[0]) {
        const result = intents.create(input);
        audit.record({
          id: `aud_intent_${result.intent.id}`,
          actorType: "system",
          actorId: "api",
          eventType: "intent.created",
          objectType: "intent",
          objectId: result.intent.id,
          spaceId: result.intent.spaceId,
          payload: { status: result.intent.status }
        });
        persist();
        return result;
      },
      get: intents.get,
      list: intents.list
    },
    payments: {
      create(input: Parameters<typeof payments.create>[0]) {
        const result = payments.create(input);
        settlements.create(result.settlement);
        ledger.record({
          id: `led_${result.payment.id}_hold`,
          accountId: `recipient:${result.payment.recipientId}`,
          entryType: "liability_hold",
          asset: result.payment.asset,
          amount: result.payment.amount,
          referenceType: "payment",
          referenceId: result.payment.id
        });
        audit.record({
          id: `aud_payment_${result.payment.id}_created`,
          actorType: "system",
          actorId: "api",
          eventType: "payment.created",
          objectType: "payment",
          objectId: result.payment.id,
          payload: { settlementMode: result.settlement.mode }
        });
        persist();
        return result;
      },
      get: payments.get,
      update: (paymentId: string, updates: Partial<Parameters<typeof payments.update>[1]>) => {
        const payment = payments.update(paymentId, updates);
        persist();
        return payment;
      },
      transitionStatus: (
        paymentId: string,
        expectedStatus: Parameters<typeof payments.transitionStatus>[1],
        newStatus: Parameters<typeof payments.transitionStatus>[2],
        extra?: Parameters<typeof payments.transitionStatus>[3]
      ) => {
        const payment = payments.transitionStatus(paymentId, expectedStatus, newStatus, extra);
        persist();
        return payment;
      },
      execute(paymentId: string) {
        const result = payments.execute(paymentId);
        settlements.markSettled(paymentId, result);
        ledger.record({
          id: `led_${paymentId}_settled`,
          accountId: `recipient:${result.payment.recipientId}`,
          entryType: "settlement_complete",
          asset: result.payment.asset,
          amount: result.payment.amount,
          referenceType: "settlement",
          referenceId: `stl_${paymentId}`
        });
        audit.record({
          id: `aud_settlement_${paymentId}_settled`,
          actorType: "system",
          actorId: "api",
          eventType: "settlement.completed",
          objectType: "settlement",
          objectId: `stl_${paymentId}`,
          payload: { txHash: result.txHash ?? null }
        });
        persist();
        return result;
      },
      async executeAsync(paymentId: string) {
        const job = jobs.queueSettlementJob(paymentId);
        audit.record({
          id: `aud_job_${job.id}_queued`,
          actorType: "system",
          actorId: "api",
          eventType: "worker.job.queued",
          objectType: "worker_job",
          objectId: job.id,
          payload: {
            paymentId: job.paymentId,
            settlementId: job.settlementId
          }
        });
        persist();
        return {
          status: "queued" as const,
          jobId: job.id,
          paymentId: job.paymentId,
          settlementId: job.settlementId
        };
      },
      claim(paymentId: string, input: { walletAddress: string }) {
        const result = payments.claim(paymentId, input);
        settlements.markClaimed(paymentId, result);
        ledger.record({
          id: `led_${paymentId}_claimed`,
          accountId: `recipient:${result.payment.recipientId}`,
          entryType: "claim_complete",
          asset: result.payment.asset,
          amount: result.payment.amount,
          referenceType: "settlement",
          referenceId: `stl_${paymentId}`
        });
        audit.record({
          id: `aud_settlement_${paymentId}_claimed`,
          actorType: "system",
          actorId: "api",
          eventType: "settlement.claimed",
          objectType: "settlement",
          objectId: `stl_${paymentId}`,
          payload: { destination: result.destination }
        });
        persist();
        return result;
      },
      list: payments.list,
      exportState: payments.exportState
    },
    ledger: {
      get: ledger.get,
      list: ledger.list
    },
    audit: {
      get: audit.get,
      list: audit.list,
      record: (event: Parameters<typeof audit.record>[0]) => {
        const recorded = audit.record(event);
        persist();
        return recorded;
      }
    },
    settlements: {
      get: settlements.get,
      list: settlements.list,
      async confirmPending(
        confirmTx: Parameters<typeof createSettlementConfirmationLoop>[0]["confirmTx"]
      ) {
        const loop = createSettlementConfirmationLoop({
          settlements,
          confirmTx
        });
        const results = await loop.runPendingConfirmations();

        for (const result of results.filter((entry) => entry.confirmed)) {
          audit.record({
            id: `aud_settlement_${result.paymentId}_confirmed`,
            actorType: "system",
            actorId: "worker",
            eventType: "settlement.confirmed",
            objectType: "settlement",
            objectId: `stl_${result.paymentId}`,
            payload: { txHash: result.txHash }
          });
        }

        persist();
        return results;
      }
    },
    jobs: {
      list: jobs.listJobs,
      claimNext(leaseOwner: string) {
        const claimed = jobs.claimNextJob(leaseOwner);
        persist();
        return claimed;
      },
      async process(jobId: string) {
        const processed = await jobs.processJob(jobId, async (job) => {
          const result = await payments.executeAsync(job.paymentId);
          settlements.markSettled(job.paymentId, result);
          ledger.record({
            id: `led_${job.paymentId}_settled`,
            accountId: `recipient:${result.payment.recipientId}`,
            entryType: "settlement_complete",
            asset: result.payment.asset,
            amount: result.payment.amount,
            referenceType: "settlement",
            referenceId: `stl_${job.paymentId}`
          });
          audit.record({
            id: `aud_settlement_${job.paymentId}_settled`,
            actorType: "system",
            actorId: "worker",
            eventType: "settlement.completed",
            objectType: "settlement",
            objectId: `stl_${job.paymentId}`,
            payload: {
              txHash: result.txHash ?? null,
              simulated: result.simulated ?? false
            }
          });
          return { txHash: result.txHash };
        });
        persist();
        return processed;
      },
      async runQueued(leaseOwner: string) {
        const processed = await jobs.drainQueuedJobs(leaseOwner, async (job) => {
          const result = await payments.executeAsync(job.paymentId);
          settlements.markSettled(job.paymentId, result);
          ledger.record({
            id: `led_${job.paymentId}_settled`,
            accountId: `recipient:${result.payment.recipientId}`,
            entryType: "settlement_complete",
            asset: result.payment.asset,
            amount: result.payment.amount,
            referenceType: "settlement",
            referenceId: `stl_${job.paymentId}`
          });
          audit.record({
            id: `aud_settlement_${job.paymentId}_settled`,
            actorType: "system",
            actorId: "worker",
            eventType: "settlement.completed",
            objectType: "settlement",
            objectId: `stl_${job.paymentId}`,
            payload: {
              txHash: result.txHash ?? null,
              simulated: result.simulated ?? false
            }
          });
          return { txHash: result.txHash };
        });
        persist();
        return processed;
      }
    },
    idempotency: {
      async get(principalId: string, route: string, key: string) {
        if (options.identity?.repository?.getIdempotencyRecord) {
          return options.identity.repository.getIdempotencyRecord(principalId, route, key);
        }
        return inMemoryIdempotency.get(`${principalId}:${route}:${key}`);
      },
      async save(record: IdempotencyRecord) {
        if (options.identity?.repository?.saveIdempotencyRecord) {
          await options.identity.repository.saveIdempotencyRecord(record);
          return;
        }
        inMemoryIdempotency.set(
          `${record.principalId}:${record.route}:${record.key}`,
          structuredClone(record)
        );
      }
    },
    spaces,
    notifications,
    confirmer: options.settlement?.confirmer
  };
};

export const createApiAppAsync = async (
  options: CreateApiAppOptions & {
    databaseUrl?: string;
  } = {}
) => {
  let repository = options.identity?.repository;
  let spaces = options.spaces;

  if (!repository) {
    const connectionString = options.databaseUrl ?? process.env.DATABASE_URL;
    if (connectionString) {
      const client = await createNodePostgresClient({ connectionString });
      repository = createPostgresAppRepository({ client });
      if (!spaces) {
        spaces = createPostgresSpaceService({ client });
      }
    }
  }

  let provisioner = options.identity?.provisioner;

  if (!provisioner && process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET) {
    const adapter = createPrivyAdapter({
      appId: process.env.PRIVY_APP_ID,
      appSecret: process.env.PRIVY_APP_SECRET,
      apiUrl: process.env.PRIVY_API_URL
    });
    provisioner = createPrivyProvisioner(adapter);
  }

  const initialState = repository ? await repository.load() : options.identity?.initialState;
  const appState = repository?.loadAppState ? await repository.loadAppState() : options.state;
  const app = createApiApp({
    ...options,
    spaces,
    identity: {
      ...options.identity,
      initialState,
      provisioner,
      repository
    },
    state: appState
  });

  if (!repository) {
    return app;
  }

  const syncNotifications = async () => {
    if (!repository?.upsertNotification) {
      return;
    }

    await Promise.all(
      app.notifications.list().map((event) => repository!.upsertNotification!(event))
    );
  };

  const syncSettlements = async () => {
    if (!repository?.upsertSettlement) {
      return;
    }

    await Promise.all(
      app.settlements.list().map((record) => repository!.upsertSettlement!(record))
    );
  };

  const syncLedger = async () => {
    if (!repository?.upsertLedgerEntry) {
      return;
    }

    await Promise.all(
      app.ledger.list().map((entry) => repository!.upsertLedgerEntry!(entry))
    );
  };

  const syncAudit = async () => {
    if (!repository?.upsertAuditEvent) {
      return;
    }

    await Promise.all(
      app.audit.list().map((event) => repository!.upsertAuditEvent!(event))
    );
  };

  const syncJobs = async () => {
    if (!repository?.upsertWorkerJob) {
      return;
    }

    await Promise.all(
      app.jobs.list().map((job) => repository!.upsertWorkerJob!(job))
    );
  };

  return {
    ...app,
    resolveRecipient: async (input: RecipientResolutionInput) => {
      const recipient = app.recipients.resolve(input);
      await repository.upsertRecipient(recipient);
      return recipient;
    },
    recipients: {
      resolve: async (input: RecipientResolutionInput) => {
        const recipient = app.recipients.resolve(input);
        await repository.upsertRecipient(recipient);
        return recipient;
      },
      get: async (recipientId: string) => app.recipients.get(recipientId),
      claim: async (
        recipientId: string,
        input: Parameters<typeof app.recipients.claim>[1]
      ) => {
        const recipient = await app.recipients.claim(recipientId, input);
        const user = app.users.getByPrivyUserId(input.privyUserId);

        if (user) {
          await repository.upsertUser(user);
        }
        await repository.upsertRecipient(recipient);

        return recipient;
      },
      list: async () => app.recipients.list()
    },
    envelopes: {
      create: async (input: Parameters<typeof app.envelopes.create>[0]) => {
        const envelope = app.envelopes.create(input);
        await repository.upsertEnvelope?.(envelope);
        await syncAudit();
        return envelope;
      },
      get: async (envelopeId: string) => app.envelopes.get(envelopeId),
      list: async () => app.envelopes.list(),
      evaluate: async (
        envelopeId: string,
        intent: Parameters<typeof app.envelopes.evaluate>[1]
      ) => app.envelopes.evaluate(envelopeId, intent)
    },
    intents: {
      create: async (input: Parameters<typeof app.intents.create>[0]) => {
        const result = app.intents.create(input);
        if (repository?.saveIntentWithAudit) {
          const auditEvent = app.audit.list().find((e) => e.objectId === result.intent.id);
          if (auditEvent) {
            await repository.saveIntentWithAudit(result.intent, auditEvent);
          } else {
            await repository.upsertIntent?.(result.intent);
            await syncAudit();
          }
        } else {
          await repository?.upsertIntent?.(result.intent);
          await syncAudit();
        }
        return result;
      },
      get: async (intentId: string) => app.intents.get(intentId),
      list: async () => app.intents.list()
    },
    payments: {
      create: async (input: Parameters<typeof app.payments.create>[0]) => {
        const result = app.payments.create(input);
        await repository.upsertPaymentState?.({
          payment: result.payment,
          settlement: result.settlement
        });
        await syncSettlements();
        await syncLedger();
        await syncAudit();
        await syncNotifications();
        return result;
      },
      get: async (paymentId: string) => app.payments.get(paymentId),
      update: async (paymentId: string, updates: Partial<Parameters<typeof app.payments.update>[1]>) => {
        const payment = app.payments.update(paymentId, updates);
        const settlement = app.settlements.get(paymentId);
        if (settlement && repository?.upsertPaymentState) {
          await repository.upsertPaymentState({
            payment,
            settlement: settlement as any
          });
        }
        return payment;
      },
      transitionStatus: async (
        paymentId: string,
        expectedStatus: Parameters<typeof app.payments.transitionStatus>[1],
        newStatus: Parameters<typeof app.payments.transitionStatus>[2],
        extra?: Parameters<typeof app.payments.transitionStatus>[3]
      ) => {
        const payment = app.payments.transitionStatus(paymentId, expectedStatus, newStatus, extra);
        if (repository?.updatePaymentTransition) {
          const exp = Array.isArray(expectedStatus) ? expectedStatus[0]! : expectedStatus;
          await repository.updatePaymentTransition(paymentId, exp, newStatus, extra?.txHash);
        } else if (repository?.upsertPaymentState) {
          const settlement = app.settlements.get(paymentId);
          if (settlement) {
            await repository.upsertPaymentState({
              payment,
              settlement: settlement as any
            });
          }
        }
        return payment;
      },
      execute: async (paymentId: string) => {
        const result = app.payments.execute(paymentId);
        await repository.upsertPaymentState?.({
          payment: result.payment,
          settlement: result.settlement
        });
        await syncSettlements();
        await syncLedger();
        await syncAudit();
        await syncNotifications();
        return result;
      },
      executeAsync: async (paymentId: string) => {
        const queued = await app.payments.executeAsync(paymentId);
        await syncJobs();
        await syncAudit();
        return queued;
      },
      claim: async (paymentId: string, input: { walletAddress: string }) => {
        const result = app.payments.claim(paymentId, input);
        await repository.upsertPaymentState?.({
          payment: result.payment,
          settlement: result.settlement
        });
        await syncSettlements();
        await syncLedger();
        await syncAudit();
        await syncNotifications();
        return result;
      },
      list: async () => app.payments.list()
    },
    ledger: {
      get: async (entryId: string) => app.ledger.get(entryId),
      list: async () => app.ledger.list()
    },
    audit: {
      get: async (eventId: string) => app.audit.get(eventId),
      list: async () => app.audit.list(),
      record: async (event: Parameters<typeof app.audit.record>[0]) => {
        const recorded = app.audit.record(event);
        await syncAudit();
        return recorded;
      }
    },
    settlements: {
      get: async (paymentId: string) => app.settlements.get(paymentId),
      list: async () => app.settlements.list(),
      confirmPending: async (
        confirmTx: Parameters<typeof app.settlements.confirmPending>[0]
      ) => {
        const results = await app.settlements.confirmPending(confirmTx);
        await syncSettlements();
        await syncAudit();
        return results;
      }
    },
    jobs: {
      list: async () => app.jobs.list(),
      claimNext: async (leaseOwner: string) => {
        const claimed = app.jobs.claimNext(leaseOwner);
        await syncJobs();
        return claimed;
      },
      process: async (jobId: string) => {
        const processed = await app.jobs.process(jobId);
        const paymentState = app
          .payments
          .exportState()
          .find((entry) => entry.payment.id === processed.paymentId);

        if (!paymentState) {
          throw new Error(`Unknown payment state for job: ${jobId}`);
        }

        await repository.upsertPaymentState?.({
          payment: paymentState.payment,
          settlement: paymentState.settlement
        });
        await syncJobs();
        await syncSettlements();
        await syncLedger();
        await syncAudit();
        await syncNotifications();
        return processed;
      },
      runQueued: async (leaseOwner: string) => {
        const processed = await app.jobs.runQueued(leaseOwner);

        await Promise.all(
          app.payments
            .exportState()
            .filter((entry) =>
              processed.some((job) => job.paymentId === entry.payment.id)
            )
            .map((entry) => repository.upsertPaymentState?.(entry))
        );

        await syncJobs();
        await syncSettlements();
        await syncLedger();
        await syncAudit();
        await syncNotifications();
        return processed;
      }
    },
    notifications: {
      emit: async (event: Parameters<typeof app.notifications.emit>[0]) => {
        const enriched = await app.notifications.emit(event);
        await repository.upsertNotification?.(enriched);
        return enriched;
      },
      hydrate: app.notifications.hydrate,
      list: async () => app.notifications.list()
    }
  };
};
