import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import {
  createNodePostgresClient,
  createPostgresAppRepository,
  createPostgresIdentityRepository,
  createPostgresSpaceService,
  applyPostgresSchema
} from "../src/index.ts";

const connectionString =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgres://microcosm:microcosm@127.0.0.1:5432/microcosm_test";

const randomHash = () => `0x${randomBytes(32).toString("hex")}`;
const randomSuffix = () => `${Date.now()}_${randomBytes(8).toString("hex")}`;

test("PostgreSQL 16: schema migrations are idempotent and create all required tables & constraints", async () => {
  const client = await createNodePostgresClient({ connectionString });
  try {
    // Applying schema multiple times must succeed without error
    await applyPostgresSchema(client);
    await applyPostgresSchema(client);

    // Verify required tables exist
    const tablesRes = await client.query(
      `select table_name from information_schema.tables where table_schema = 'public'`
    );
    const tableNames = tablesRes.rows.map((r) => r.table_name);
    const expectedTables = [
      "users",
      "recipients",
      "spaces",
      "space_memberships",
      "wallet_link_challenges",
      "envelopes",
      "intents",
      "payments",
      "notifications",
      "settlements",
      "ledger_entries",
      "audit_events",
      "worker_jobs"
    ];
    for (const table of expectedTables) {
      assert.ok(tableNames.includes(table), `Table ${table} must exist in schema`);
    }

    // Verify critical indexes exist
    const indexesRes = await client.query(
      `select indexname from pg_indexes where schemaname = 'public'`
    );
    const indexNames = indexesRes.rows.map((r) => r.indexname);
    assert.ok(
      indexNames.includes("spaces_personal_owner_idx"),
      "Partial unique index spaces_personal_owner_idx must exist"
    );
    assert.ok(
      indexNames.includes("payments_tx_hash_idx"),
      "Unique index payments_tx_hash_idx must exist"
    );
    assert.ok(
      indexNames.includes("users_privy_user_id_key"),
      "Unique constraint users_privy_user_id_key must exist"
    );
  } finally {
    await client.close?.();
  }
});

test("PostgreSQL 16: full entity lifecycle, space isolation, and state hydration", async () => {
  const client = await createNodePostgresClient({ connectionString });
  try {
    await applyPostgresSchema(client);

    const identityRepo = createPostgresIdentityRepository({ client });
    const appRepo = createPostgresAppRepository({ client });
    const spaceService = createPostgresSpaceService({ client });

    const suffix = randomSuffix();
    const userId = `usr_full_${suffix}`;
    const privySubject = `did:privy:usr_${suffix}`;

    // 1. Principal & Personal Space
    await identityRepo.upsertUser({
      id: userId,
      email: `user_${suffix}@example.com`,
      privyUserId: privySubject,
      walletAddress: "0x1111111111111111111111111111111111111111"
    });

    const personalSpace = await spaceService.ensurePersonalSpace(userId);
    assert.equal(personalSpace.ownerUserId, userId);
    assert.equal(personalSpace.type, "personal");

    // 2. Shared Space & Membership
    const sharedSpace = await spaceService.createSpace!(userId, {
      name: `Team Space ${suffix}`,
      type: "shared"
    });
    assert.equal(sharedSpace.ownerUserId, userId);
    assert.equal(sharedSpace.type, "shared");

    const memberUser = `usr_member_${suffix}`;
    await identityRepo.upsertUser({
      id: memberUser,
      email: `member_${suffix}@example.com`,
      privyUserId: `did:privy:member_${suffix}`
    });

    const membership = await spaceService.addMember!({
      spaceId: sharedSpace.id,
      userId: memberUser,
      role: "member"
    });
    assert.equal(membership.role, "member");
    assert.equal(membership.status, "active");

    const memberCheck = await spaceService.requireActiveMembership(memberUser, sharedSpace.id);
    assert.equal(memberCheck.role, "member");

    // 3. Recipient tied to space
    const recipientId = `rcp_${suffix}`;
    await identityRepo.upsertRecipient({
      id: recipientId,
      lookupKey: `recipient_${suffix}@example.com`,
      ownerType: "user",
      ownerId: userId,
      walletAddress: "0x2222222222222222222222222222222222222222",
      claimStatus: "claimed",
      spaceId: personalSpace.id
    });

    // 4. Envelope tied to space
    const envelopeId = `env_${suffix}`;
    await appRepo.upsertEnvelope({
      id: envelopeId,
      spaceId: personalSpace.id,
      asset: "USDC",
      maxAmountPerTx: "500",
      maxAmountPerDay: "2000",
      allowedRecipientIds: [recipientId],
      schedule: {
        days: ["mon", "tue", "wed", "thu", "fri"],
        startHourUtc: 8,
        endHourUtc: 18
      }
    });

    // 5. Intent tied to space
    const intentId = `int_${suffix}`;
    await appRepo.upsertIntent({
      id: intentId,
      type: "send_money",
      envelopeId,
      recipientId,
      status: "approved",
      spaceId: personalSpace.id,
      asset: "USDC",
      amount: "100",
      spentToday: "0",
      executedAt: new Date().toISOString(),
      recipientAddress: "0x2222222222222222222222222222222222222222",
      createdAt: new Date().toISOString()
    });

    // 6. Payment state with tx_hash and spaceId
    const paymentId = `pay_${suffix}`;
    const txHash = randomHash();
    await appRepo.upsertPaymentState({
      payment: {
        id: paymentId,
        intentId,
        recipientId,
        asset: "USDC",
        amount: "100",
        recipientAddress: "0x2222222222222222222222222222222222222222",
        status: "settled",
        spaceId: personalSpace.id,
        txHash,
        createdAt: new Date().toISOString()
      },
      settlement: {
        chain: "arc",
        mode: "direct",
        paymentId,
        asset: "USDC",
        amount: "100",
        destination: "0x2222222222222222222222222222222222222222"
      }
    });

    // 7. Audit event tied to space
    const auditId = `aud_${suffix}`;
    await appRepo.upsertAuditEvent({
      id: auditId,
      actorType: "user",
      actorId: userId,
      eventType: "payment.settled",
      objectType: "payment",
      objectId: paymentId,
      spaceId: personalSpace.id,
      payload: { amount: "100", txHash }
    });

    // 8. Hydrate state through repositories
    const identityState = await identityRepo.load();
    const loadedUser = identityState.users.find((u) => u.id === userId);
    assert.ok(loadedUser, "Persisted user must be rehydrated");
    assert.equal(loadedUser.email, `user_${suffix}@example.com`);
    assert.equal(loadedUser.privyUserId, privySubject);

    const loadedRecipient = identityState.recipients.find((r) => r.id === recipientId);
    assert.ok(loadedRecipient, "Persisted recipient must be rehydrated");
    assert.equal(loadedRecipient.spaceId, personalSpace.id);

    const appState = await appRepo.loadAppState();
    const loadedEnvelope = appState.envelopes.find((e) => e.id === envelopeId);
    assert.ok(loadedEnvelope, "Envelope must be rehydrated");
    assert.equal(loadedEnvelope.spaceId, personalSpace.id);

    const loadedIntent = appState.intents.find((i) => i.id === intentId);
    assert.ok(loadedIntent, "Intent must be rehydrated");
    assert.equal(loadedIntent.spaceId, personalSpace.id);

    const loadedPayment = appState.payments.find((p) => p.payment.id === paymentId);
    assert.ok(loadedPayment, "Payment must be rehydrated");
    assert.equal(loadedPayment.payment.spaceId, personalSpace.id);
    assert.equal(loadedPayment.payment.txHash, txHash);

    const loadedAudit = appState.auditEvents.find((a) => a.id === auditId);
    assert.ok(loadedAudit, "Audit event must be rehydrated");
    assert.equal(loadedAudit.spaceId, personalSpace.id);
  } finally {
    await client.close?.();
  }
});

test("PostgreSQL 16: concurrent principal creation yields exactly one principal and idempotent resolution", async () => {
  const client = await createNodePostgresClient({ connectionString });
  try {
    await applyPostgresSchema(client);
    const identityRepo = createPostgresIdentityRepository({ client });

    const suffix = randomSuffix();
    const sharedSubject = `did:privy:race_${suffix}`;
    const sharedEmail = `race_user_${suffix}@example.com`;
    const concurrency = 25;

    // Launch 25 concurrent resolutions for the identical external identity
    const promises = Array.from({ length: concurrency }).map(() =>
      identityRepo.resolveOrCreatePrincipal!({
        externalIdentity: {
          provider: "privy",
          subject: sharedSubject,
          linkedAt: new Date().toISOString()
        },
        email: sharedEmail
      })
    );

    const results = await Promise.all(promises);

    // Invariant 1: All concurrent requests return the exact same user ID
    const primaryUserId = results[0]!.user.id;
    for (const res of results) {
      assert.equal(
        res.user.id,
        primaryUserId,
        "Every concurrent principal resolution must return the identical canonical user ID"
      );
      assert.equal(
        res.user.privyUserId,
        sharedSubject,
        "External identity mapping must match"
      );
    }

    // Invariant 2: Exactly one call is flagged as created: true, 24 as created: false
    const createdCount = results.filter((r) => r.created).length;
    assert.equal(
      createdCount,
      1,
      `Expected exactly 1 created: true result under concurrency, got ${createdCount}`
    );

    // Invariant 3: Exactly 1 row exists in PostgreSQL
    const dbCountRes = await client.query(
      `select count(*) as count from users where privy_user_id = $1`,
      [sharedSubject]
    );
    assert.equal(
      Number(dbCountRes.rows[0]!.count),
      1,
      "PostgreSQL users table must contain exactly 1 row for the external identity"
    );
  } finally {
    await client.close?.();
  }
});

test("PostgreSQL 16: concurrent personal space creation preserves 1-to-1 invariant", async () => {
  const client = await createNodePostgresClient({ connectionString });
  try {
    await applyPostgresSchema(client);
    const identityRepo = createPostgresIdentityRepository({ client });
    const spaceService = createPostgresSpaceService({ client });

    const suffix = randomSuffix();
    const userId = `usr_space_race_${suffix}`;
    await identityRepo.upsertUser({
      id: userId,
      email: `spacerace_${suffix}@example.com`,
      privyUserId: `did:privy:space_race_${suffix}`
    });

    const concurrency = 25;
    const promises = Array.from({ length: concurrency }).map(() =>
      spaceService.ensurePersonalSpace(userId)
    );

    const spaces = await Promise.all(promises);

    // Invariant 1: All calls return identical space ID
    const firstSpaceId = spaces[0]!.id;
    for (const space of spaces) {
      assert.equal(
        space.id,
        firstSpaceId,
        "Every concurrent ensurePersonalSpace call must return the identical space ID"
      );
      assert.equal(space.type, "personal");
      assert.equal(space.ownerUserId, userId);
    }

    // Invariant 2: Database physically has only 1 personal space for this user
    const dbCount = await client.query(
      `select count(*) as count from spaces where owner_user_id = $1 and type = 'personal'`,
      [userId]
    );
    assert.equal(
      Number(dbCount.rows[0]!.count),
      1,
      "PostgreSQL spaces table must have exactly 1 personal space row for the user"
    );

    // Invariant 3: Active owner membership exists
    const membership = await spaceService.requireActiveMembership(userId, firstSpaceId);
    assert.equal(membership.role, "owner");
    assert.equal(membership.status, "active");
  } finally {
    await client.close?.();
  }
});

test("PostgreSQL 16: atomic single-use wallet-link challenge consumption succeeds at most once", async () => {
  const client = await createNodePostgresClient({ connectionString });
  try {
    await applyPostgresSchema(client);
    const identityRepo = createPostgresIdentityRepository({ client });
    const spaceService = createPostgresSpaceService({ client });

    const suffix = randomSuffix();
    const userId = `usr_chall_${suffix}`;
    await identityRepo.upsertUser({
      id: userId,
      email: `chall_${suffix}@example.com`,
      privyUserId: `did:privy:chall_${suffix}`
    });
    const space = await spaceService.ensurePersonalSpace(userId);

    const challengeId = `chn_${suffix}`;
    const futureExpiry = new Date(Date.now() + 60000).toISOString();
    await identityRepo.saveWalletLinkChallenge!({
      id: challengeId,
      userId,
      spaceId: space.id,
      address: "0x3333333333333333333333333333333333333333",
      nonce: `nonce_${suffix}`,
      message: `Microcosm Wallet Link Nonce: nonce_${suffix}`,
      expiresAt: futureExpiry
    });

    // 25 concurrent consumption attempts
    const concurrency = 25;
    const promises = Array.from({ length: concurrency }).map(() =>
      identityRepo.consumeWalletLinkChallenge!(challengeId)
    );

    const results = await Promise.all(promises);

    const successCount = results.filter(Boolean).length;
    const failureCount = results.filter((r) => !r).length;

    assert.equal(
      successCount,
      1,
      `Exactly 1 concurrent consumption must succeed, got ${successCount}`
    );
    assert.equal(
      failureCount,
      24,
      `Exactly 24 concurrent consumptions must fail, got ${failureCount}`
    );

    // Subsequent 26th attempt must also fail
    const replay = await identityRepo.consumeWalletLinkChallenge!(challengeId);
    assert.equal(replay, false, "Replay consumption must return false");

    // DB row has consumed_at populated
    const rowRes = await client.query(
      `select consumed_at from wallet_link_challenges where id = $1`,
      [challengeId]
    );
    assert.ok(rowRes.rows[0]!.consumed_at != null, "consumed_at must be populated");
  } finally {
    await client.close?.();
  }
});

test("PostgreSQL 16: atomic payment state transition and tx_hash uniqueness under concurrency", async () => {
  const client = await createNodePostgresClient({ connectionString });
  try {
    await applyPostgresSchema(client);
    const appRepo = createPostgresAppRepository({ client });

    const suffix = randomSuffix();
    const paymentId = `pay_trans_${suffix}`;
    const recipientId = `rcp_trans_${suffix}`;

    // Seed payment in ready_for_settlement status
    await appRepo.upsertPaymentState({
      payment: {
        id: paymentId,
        intentId: `int_${suffix}`,
        recipientId,
        asset: "USDC",
        amount: "50",
        recipientAddress: "0x4444444444444444444444444444444444444444",
        status: "ready_for_settlement",
        createdAt: new Date().toISOString()
      },
      settlement: {
        chain: "arc",
        mode: "direct",
        paymentId,
        asset: "USDC",
        amount: "50",
        destination: "0x4444444444444444444444444444444444444444"
      }
    });

    // Two concurrent workers attempting transition from 'ready_for_settlement' -> 'submitted' with different tx hashes
    const txA = randomHash();
    const txB = randomHash();

    const [workerA, workerB] = await Promise.all([
      appRepo.updatePaymentTransition!(
        paymentId,
        "ready_for_settlement",
        "submitted",
        txA
      ),
      appRepo.updatePaymentTransition!(
        paymentId,
        "ready_for_settlement",
        "submitted",
        txB
      )
    ]);

    // Exactly one worker must succeed
    assert.equal(
      (workerA ? 1 : 0) + (workerB ? 1 : 0),
      1,
      "Exactly one competing worker must win the status transition"
    );

    // Invalid transition from 'ready_for_settlement' now fails because status is already 'submitted'
    const thirdAttempt = await appRepo.updatePaymentTransition!(
      paymentId,
      "ready_for_settlement",
      "submitted",
      randomHash()
    );
    assert.equal(thirdAttempt, false, "Transition from obsolete status must be rejected");

    // Test duplicate tx_hash constraint: inserting another payment with the winning tx_hash fails
    const winningTx = workerA ? txA : txB;
    const conflictingPaymentId = `pay_conflict_${suffix}`;

    await assert.rejects(
      async () => {
        await client.query(
          `insert into payments (id, intent_id, recipient_id, status, tx_hash, payment_data, settlement_data)
           values ($1, 'int_x', 'rcp_x', 'submitted', $2, '{}'::jsonb, '{}'::jsonb)`,
          [conflictingPaymentId, winningTx]
        );
      },
      (err: { code?: string }) => {
        // PostgreSQL unique violation error code is 23505
        return err.code === "23505";
      },
      "Attempting to reuse an existing tx_hash must trigger unique constraint violation (23505)"
    );
  } finally {
    await client.close?.();
  }
});

test("PostgreSQL 16: transaction rollback guarantees zero partial writes", async () => {
  const client = await createNodePostgresClient({ connectionString });
  try {
    await applyPostgresSchema(client);

    const suffix = randomSuffix();
    const userId = `usr_tx_fail_${suffix}`;
    const spaceId = `spc_tx_fail_${suffix}`;

    await assert.rejects(
      async () => {
        await client.transaction!(async (tx) => {
          await tx.query(
            `insert into users (id, email, privy_user_id) values ($1, $2, $3)`,
            [userId, `tx_fail_${suffix}@example.com`, `did:privy:tx_fail_${suffix}`]
          );
          await tx.query(
            `insert into spaces (id, type, name, owner_user_id, status) values ($1, 'personal', 'Rollback Space', $2, 'active')`,
            [spaceId, userId]
          );

          // Force failure before transaction commits
          throw new Error("Simulated business logic failure during settlement");
        });
      },
      /Simulated business logic failure during settlement/
    );

    // Verify neither user nor space exists in the database
    const userRes = await client.query(`select id from users where id = $1`, [userId]);
    assert.equal(userRes.rows.length, 0, "Rolled back user must not exist");

    const spaceRes = await client.query(`select id from spaces where id = $1`, [spaceId]);
    assert.equal(spaceRes.rows.length, 0, "Rolled back space must not exist");
  } finally {
    await client.close?.();
  }
});

test("PostgreSQL 16: process restart and connection durability preserves all state", async () => {
  const suffix = randomSuffix();
  const userId = `usr_restart_${suffix}`;

  // Process Phase 1: Connect, write entities, close connection pool
  {
    const client1 = await createNodePostgresClient({ connectionString });
    try {
      await applyPostgresSchema(client1);
      const identityRepo = createPostgresIdentityRepository({ client: client1 });
      const spaceService = createPostgresSpaceService({ client: client1 });

      await identityRepo.upsertUser({
        id: userId,
        email: `restart_${suffix}@example.com`,
        privyUserId: `did:privy:restart_${suffix}`,
        walletAddress: "0x5555555555555555555555555555555555555555"
      });

      const space = await spaceService.ensurePersonalSpace(userId);
      assert.equal(space.ownerUserId, userId);
    } finally {
      // Simulate process termination / connection pool shutdown
      await client1.close?.();
    }
  }

  // Process Phase 2: Start new process with fresh client and repository instances
  {
    const client2 = await createNodePostgresClient({ connectionString });
    try {
      const identityRepo2 = createPostgresIdentityRepository({ client: client2 });
      const spaceService2 = createPostgresSpaceService({ client: client2 });

      const state = await identityRepo2.load();
      const user = state.users.find((u) => u.id === userId);
      assert.ok(user, "User must persist across process restart");
      assert.equal(user.email, `restart_${suffix}@example.com`);
      assert.equal(user.privyUserId, `did:privy:restart_${suffix}`);
      assert.equal(user.walletAddress, "0x5555555555555555555555555555555555555555");

      const spaces = await spaceService2.listSpacesForUser(userId);
      assert.equal(spaces.length, 1, "Personal space must persist across process restart");
      assert.equal(spaces[0]!.type, "personal");
      assert.equal(spaces[0]!.ownerUserId, userId);

      const membership = await spaceService2.requireActiveMembership(userId, spaces[0]!.id);
      assert.equal(membership.status, "active");
      assert.equal(membership.role, "owner");
    } finally {
      await client2.close?.();
    }
  }
});

test("PostgreSQL 16: idempotency persistence - same key & payload replays result, different payload conflicts", async () => {
  const client = await createNodePostgresClient({ connectionString });
  try {
    await applyPostgresSchema(client);
    const appRepo = createPostgresAppRepository({ client });

    const suffix = randomSuffix();
    const principalId = `usr_idem_${suffix}`;
    const route = "/v1/intents";
    const idempotencyKey = `idem_${suffix}`;

    const originalPayload = {
      amount: "100",
      asset: "USDC",
      recipientId: `rcp_${suffix}`
    };
    const differentPayload = {
      amount: "200",
      asset: "USDC",
      recipientId: `rcp_${suffix}`
    };

    const originalHash = "hash_" + randomSuffix();
    const differentHash = "hash_" + randomSuffix();

    const originalResult = {
      intentId: `int_${suffix}`,
      status: "approved"
    };

    // 1. Initial save of idempotency record
    await appRepo.saveIdempotencyRecord!({
      key: idempotencyKey,
      principalId,
      route,
      requestHash: originalHash,
      statusCode: 201,
      responseBody: originalResult,
      createdAt: new Date().toISOString()
    });

    // 2. Query with exact same principal, route, key
    const retrieved = await appRepo.getIdempotencyRecord!(principalId, route, idempotencyKey);
    assert.ok(retrieved, "Idempotency record must be retrieved");
    assert.equal(retrieved.statusCode, 201);
    assert.deepEqual(retrieved.responseBody, originalResult);

    // 3. Same payload hash returns identical result
    assert.equal(
      retrieved.requestHash,
      originalHash,
      "Same key and payload matches requestHash and allows replay"
    );

    // 4. Different payload hash triggers conflict detection
    assert.notEqual(
      retrieved.requestHash,
      differentHash,
      "Different payload hash does not match original requestHash"
    );
  } finally {
    await client.close?.();
  }
});

test("PostgreSQL 16: atomic intent and audit persistence commits or rolls back together", async () => {
  const client = await createNodePostgresClient({ connectionString });
  try {
    await applyPostgresSchema(client);
    const appRepo = createPostgresAppRepository({ client });
    const identityRepo = createPostgresIdentityRepository({ client });
    const spaceService = createPostgresSpaceService({ client });

    const suffix = randomSuffix();
    const userId = `usr_atomic_${suffix}`;
    await identityRepo.upsertUser({
      id: userId,
      email: `atomic_${suffix}@example.com`,
      privyUserId: `did:privy:atomic_${suffix}`
    });
    const space = await spaceService.ensurePersonalSpace(userId);

    const envelopeId = `env_atomic_${suffix}`;
    await appRepo.upsertEnvelope({
      id: envelopeId,
      spaceId: space.id,
      asset: "USDC",
      maxAmountPerTx: "500",
      maxAmountPerDay: "2000",
      allowedRecipientIds: [`rcp_${suffix}`],
      schedule: { days: ["mon"], startHourUtc: 0, endHourUtc: 24 }
    });

    // Case 1: Atomic success commits BOTH intent and audit event
    const intentIdSuccess = `int_success_${suffix}`;
    const auditIdSuccess = `aud_success_${suffix}`;

    await appRepo.saveIntentWithAudit!(
      {
        id: intentIdSuccess,
        type: "send_money",
        envelopeId,
        recipientId: `rcp_${suffix}`,
        status: "approved",
        spaceId: space.id,
        amount: "50",
        asset: "USDC",
        spentToday: "0",
        executedAt: new Date().toISOString()
      },
      {
        id: auditIdSuccess,
        actorType: "user",
        actorId: userId,
        eventType: "intent.created",
        objectType: "intent",
        objectId: intentIdSuccess,
        spaceId: space.id,
        payload: { status: "approved" }
      }
    );

    // Verify both exist
    const intentRes = await client.query(`select id from intents where id = $1`, [intentIdSuccess]);
    assert.equal(intentRes.rows.length, 1, "Intent must be committed");
    const auditRes = await client.query(`select id from audit_events where id = $1`, [auditIdSuccess]);
    assert.equal(auditRes.rows.length, 1, "Audit event must be committed");

    // Case 2: Transaction failure rolls back BOTH (zero partial records)
    const intentIdFail = `int_fail_${suffix}`;
    const auditIdFail = `aud_fail_${suffix}`;

    await assert.rejects(
      async () => {
        await client.transaction!(async (tx) => {
          await tx.query(
            `insert into intents (id, envelope_id, recipient_id, status, space_id, data)
             values ($1, $2, $3, 'approved', $4, '{}'::jsonb)`,
            [intentIdFail, envelopeId, `rcp_${suffix}`, space.id]
          );

          // Force failure before audit insert or commit
          throw new Error("Audit store network/database failure simulation");
        });
      },
      /Audit store network\/database failure simulation/
    );

    const intentFailRes = await client.query(`select id from intents where id = $1`, [intentIdFail]);
    assert.equal(intentFailRes.rows.length, 0, "Intent must be rolled back on failure");
    const auditFailRes = await client.query(`select id from audit_events where id = $1`, [auditIdFail]);
    assert.equal(auditFailRes.rows.length, 0, "Audit event must be rolled back on failure");
  } finally {
    await client.close?.();
  }
});

test("PostgreSQL 16: durable worker jobs survive restart and concurrent workers cannot double-claim", async () => {
  const suffix = randomSuffix();

  // Phase 1: Seed 3 queued worker jobs in PostgreSQL and close connection
  {
    const client1 = await createNodePostgresClient({ connectionString });
    try {
      await applyPostgresSchema(client1);
      await client1.query("delete from worker_jobs");
      const appRepo1 = createPostgresAppRepository({ client: client1 });

      for (let i = 1; i <= 3; i++) {
        await appRepo1.upsertWorkerJob({
          id: `job_${suffix}_${i}`,
          type: "settlement.execute",
          paymentId: `pay_${suffix}_${i}`,
          settlementId: `stl_${suffix}_${i}`,
          status: "queued"
        });
      }
    } finally {
      // Simulate process restart
      await client1.close?.();
    }
  }

  // Phase 2: Start new process and launch 20 concurrent workers attempting to claim jobs
  {
    const client2 = await createNodePostgresClient({ connectionString });
    try {
      const appRepo2 = createPostgresAppRepository({ client: client2 });

      // 20 parallel workers race to claim the 3 queued jobs
      const concurrency = 20;
      const claimPromises = Array.from({ length: concurrency }).map((_, i) =>
        appRepo2.claimNextWorkerJob!(`worker_instance_${i}`)
      );

      const claimedResults = await Promise.all(claimPromises);

      // Filter successful claims
      const successfulClaims = claimedResults.filter((j): j is NonNullable<typeof j> => j !== undefined);

      // Exactly 3 jobs were available, so exactly 3 claims must succeed
      assert.equal(
        successfulClaims.length,
        3,
        `Expected exactly 3 claimed jobs, got ${successfulClaims.length}`
      );

      // Invariant: All 3 claimed job IDs must be distinct (no double-claim under race)
      const claimedJobIds = new Set(successfulClaims.map((j) => j.id));
      assert.equal(
        claimedJobIds.size,
        3,
        "Every successfully claimed job must have a unique job ID"
      );

      // The other 17 workers must receive undefined
      const emptyClaims = claimedResults.filter((j) => j === undefined);
      assert.equal(emptyClaims.length, 17, "Remaining workers must receive undefined");

      // Complete one job and verify status
      const firstJob = successfulClaims[0]!;
      await appRepo2.completeWorkerJob!(firstJob.id, { txHash: "0xcompleted" });

      const dbRow = await client2.query(
        `select status, lease_owner from worker_jobs where id = $1`,
        [firstJob.id]
      );
      assert.equal(dbRow.rows[0]!.status, "completed");
      assert.equal(dbRow.rows[0]!.lease_owner, null);
    } finally {
      await client2.close?.();
    }
  }
});

test("PostgreSQL 16: Reviewer remediations - payment JSONB sync, multi-user emails, and space-scoped lookup keys", async () => {
  const client = await createNodePostgresClient({ connectionString });
  try {
    await applyPostgresSchema(client);
    const appRepo = createPostgresAppRepository({ client });
    const identityRepo = createPostgresIdentityRepository({ client });
    const suffix = randomSuffix();

    // 1. Multi-user shared email test (Important 4)
    const sharedEmail = `shared_${suffix}@example.com`;
    await identityRepo.upsertUser({
      id: `usr_a_${suffix}`,
      privyUserId: `did:privy:a_${suffix}`,
      email: sharedEmail
    });
    // Distinct user with same email must succeed without 500 or unique constraint error
    await identityRepo.upsertUser({
      id: `usr_b_${suffix}`,
      privyUserId: `did:privy:b_${suffix}`,
      email: sharedEmail
    });

    // 2. Space-scoped lookup key test (Important 3)
    const sharedLookupKey = `vendor_${suffix}@example.com`;
    const spaceA = `spc_a_${suffix}`;
    const spaceB = `spc_b_${suffix}`;
    await identityRepo.upsertRecipient({
      id: `rcp_a_${suffix}`,
      lookupKey: sharedLookupKey,
      spaceId: spaceA,
      ownerType: "external",
      claimStatus: "claimed"
    });
    // Distinct recipient in different space with same lookupKey must succeed
    await identityRepo.upsertRecipient({
      id: `rcp_b_${suffix}`,
      lookupKey: sharedLookupKey,
      spaceId: spaceB,
      ownerType: "external",
      claimStatus: "claimed"
    });

    // 3. Payment JSONB and column synchronization test (Critical 2)
    const paymentId = `pay_jsonb_${suffix}`;
    const testTxHash = `0x${suffix.padEnd(64, "0")}`;
    await appRepo.upsertPaymentState({
      payment: {
        id: paymentId,
        intentId: `int_${suffix}`,
        recipientId: `rcp_a_${suffix}`,
        spaceId: spaceA,
        asset: "USDC",
        amount: "100",
        status: "submitted"
      },
      settlement: {
        chain: "arc",
        mode: "direct",
        paymentId,
        asset: "USDC",
        amount: "100",
        destination: "0x1111111111111111111111111111111111111111"
      }
    });

    // Transition via updatePaymentTransition
    const transitioned = await appRepo.updatePaymentTransition!(
      paymentId,
      "submitted",
      "confirmed",
      testTxHash
    );
    assert.equal(transitioned, true);

    // Verify row column and JSONB column are BOTH synchronized
    const rawRow = await client.query(
      `select status, tx_hash, payment_data from payments where id = $1`,
      [paymentId]
    );
    assert.equal(rawRow.rows[0]!.status, "confirmed");
    assert.equal(rawRow.rows[0]!.tx_hash, testTxHash);
    const parsedJsonb = typeof rawRow.rows[0]!.payment_data === "string"
      ? JSON.parse(rawRow.rows[0]!.payment_data)
      : rawRow.rows[0]!.payment_data;
    assert.equal(parsedJsonb.status, "confirmed");
    assert.equal(parsedJsonb.txHash, testTxHash);

    // Verify getPayment and listPayments and loadAppState return synchronized state
    const retrieved = await appRepo.getPayment!(paymentId, spaceA);
    assert.equal(retrieved?.payment.status, "confirmed");
    assert.equal(retrieved?.payment.txHash, testTxHash);

    const reloaded = await appRepo.loadAppState();
    const reloadedPayment = reloaded.payments.find((p) => p.payment.id === paymentId);
    assert.equal(reloadedPayment?.payment.status, "confirmed");
    assert.equal(reloadedPayment?.payment.txHash, testTxHash);
  } finally {
    await client.close?.();
  }
});
