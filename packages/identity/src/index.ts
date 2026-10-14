import {
  resolveRecipient as resolveDirectoryRecipient,
  type RecipientDirectory,
  type RecipientResolutionInput,
  type ResolvedRecipient
} from "../../recipient-resolution/src/index.ts";
import { verifyMessage } from "viem";
import { randomBytes } from "node:crypto";

export type UserRecord = {
  id: string;
  email: string;
  privyUserId: string;
  walletAddress?: string;
};

export type ExternalIdentity = {
  provider: "privy";
  subject: string;
  linkedAt: string;
  identityType?: "email" | "social" | "passkey" | "wallet" | "other";
};

export type IdentityResolution = {
  user: UserRecord;
  created: boolean;
};

export type WalletLinkChallenge = {
  id: string;
  userId: string;
  spaceId: string;
  address: `0x${string}`;
  nonce: string;
  message: string;
  expiresAt: string;
};

export const createWalletLinkChallenge = (input: {
  userId: string;
  spaceId: string;
  address: string;
  ttlMs?: number;
}): WalletLinkChallenge => {
  const ttl = input.ttlMs ?? 300_000;
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  const nonce = randomBytes(16).toString("hex");
  const normAddress = input.address.toLowerCase() as `0x${string}`;
  const message = [
    "Microcosm Wallet Association Request",
    `Account: ${input.userId}`,
    `Space: ${input.spaceId}`,
    `Wallet: ${normAddress}`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt}`,
    "",
    "Sign this message to securely link your wallet to your Microcosm account. This does not authorize any transaction or transfer."
  ].join("\n");

  return {
    id: `chg_${randomBytes(12).toString("hex")}`,
    userId: input.userId,
    spaceId: input.spaceId,
    address: normAddress,
    nonce,
    message,
    expiresAt
  };
};

export const verifyWalletLinkChallenge = async (input: {
  challenge: WalletLinkChallenge;
  signature: `0x${string}` | string;
  now?: Date;
}): Promise<boolean> => {
  const currentTime = input.now ?? new Date();
  if (currentTime.getTime() > new Date(input.challenge.expiresAt).getTime()) {
    throw new Error(`Challenge has expired at ${input.challenge.expiresAt}`);
  }

  try {
    return await verifyMessage({
      address: input.challenge.address,
      message: input.challenge.message,
      signature: input.signature as `0x${string}`
    });
  } catch {
    return false;
  }
};

export type IdentityState = {
  users: UserRecord[];
  recipients: ResolvedRecipient[];
};

export type ClaimRecipientInput = {
  email?: string;
  walletAddress?: string;
  privyUserId: string;
};

export type ProvisionedWallet = {
  walletAddress: string;
  walletId?: string;
};

export type IdentityProvisioner = {
  provisionUserWallet: (input: {
    email: string;
    privyUserId: string;
    walletAddress?: string;
  }) => Promise<ProvisionedWallet>;
};

export type IdentityRepository = {
  load: () => Promise<IdentityState>;
  upsertUser: (user: UserRecord) => Promise<void>;
  upsertRecipient: (recipient: ResolvedRecipient) => Promise<void>;
  resolveOrCreatePrincipal?: (input: {
    externalIdentity: ExternalIdentity;
    email?: string;
  }) => Promise<IdentityResolution>;
  saveWalletLinkChallenge?: (challenge: WalletLinkChallenge) => Promise<void>;
  consumeWalletLinkChallenge?: (challengeId: string) => Promise<boolean>;
  getWalletLinkChallenge?: (challengeId: string) => Promise<WalletLinkChallenge | undefined>;
};

export type IdentityService = {
  repository?: IdentityRepository;
  saveWalletLinkChallenge?: (challenge: WalletLinkChallenge) => Promise<void>;
  getWalletLinkChallenge?: (challengeId: string) => Promise<WalletLinkChallenge | undefined>;
  consumeWalletLinkChallenge?: (challengeId: string) => Promise<boolean>;
  resolveRecipient: (input: RecipientResolutionInput) => ResolvedRecipient;
  getRecipient: (id: string) => ResolvedRecipient | undefined;
  getUserByPrivyUserId: (privyUserId: string) => UserRecord | undefined;
  resolveOrCreatePrincipal: (input: {
    externalIdentity: ExternalIdentity;
    email?: string;
  }) => Promise<IdentityResolution>;
  claimRecipient: (
    recipientId: string,
    input: ClaimRecipientInput
  ) => Promise<ResolvedRecipient>;
  listRecipients: () => ResolvedRecipient[];
  createRecipient?: (input: {
    id?: string;
    spaceId: string;
    ownerUserId: string;
    recipientType: "wallet" | "email" | "handle" | "agent";
    displayLabel: string;
    address?: string;
    status?: "active" | "archived";
  }) => ResolvedRecipient;
  listUsers: () => UserRecord[];
  exportState: () => IdentityState;
  hydrate: (state: Partial<IdentityState>) => void;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeWallet = (walletAddress: string) => walletAddress.toLowerCase();

export const createIdentityService = ({
  directory = {},
  provisioner,
  repository
}: {
  directory?: RecipientDirectory;
  provisioner?: IdentityProvisioner;
  repository?: IdentityRepository;
} = {}): IdentityService => {
  const users = new Map<string, UserRecord>();
  const recipients = new Map<string, ResolvedRecipient>();
  const inMemoryChallenges = new Map<
    string,
    WalletLinkChallenge & { consumedAt?: string }
  >();

  const nextUserId = () =>
    `usr_${
      [...users.values()].reduce((max, user) => {
        const parsed = Number(user.id.replace(/^usr_/, ""));
        return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
      }, 0) + 1
    }`;

  const upsertRecipient = (recipient: ResolvedRecipient) => {
    recipients.set(recipient.id, structuredClone(recipient));
    return structuredClone(recipient);
  };

  const findRecipientByLookupKey = (lookupKey: string) =>
    [...recipients.values()].find((recipient) => recipient.lookupKey === lookupKey);

  const ensurePersistedDirectoryRecipient = (
    input: RecipientResolutionInput
  ): ResolvedRecipient | undefined => {
    try {
      const resolved = resolveDirectoryRecipient(input, directory);

      if (resolved.ownerType === "external" && resolved.claimStatus === "pending-claim") {
        return undefined;
      }

      return upsertRecipient(resolved);
    } catch {
      return undefined;
    }
  };

  return {
    repository,
    async saveWalletLinkChallenge(challenge: WalletLinkChallenge) {
      if (repository?.saveWalletLinkChallenge) {
        await repository.saveWalletLinkChallenge(challenge);
        return;
      }
      inMemoryChallenges.set(challenge.id, structuredClone(challenge));
    },
    async getWalletLinkChallenge(challengeId: string) {
      if (repository?.getWalletLinkChallenge) {
        return repository.getWalletLinkChallenge(challengeId);
      }
      const chg = inMemoryChallenges.get(challengeId);
      return chg ? structuredClone(chg) : undefined;
    },
    async consumeWalletLinkChallenge(challengeId: string) {
      if (repository?.consumeWalletLinkChallenge) {
        return repository.consumeWalletLinkChallenge(challengeId);
      }
      const chg = inMemoryChallenges.get(challengeId);
      if (!chg || chg.consumedAt || new Date(chg.expiresAt).getTime() <= Date.now()) {
        return false;
      }
      chg.consumedAt = new Date().toISOString();
      return true;
    },
    resolveRecipient(input) {
      if (input.email) {
        const lookupKey = normalizeEmail(input.email);
        const existing = findRecipientByLookupKey(lookupKey);
        if (existing) {
          return structuredClone(existing);
        }

        const seeded = ensurePersistedDirectoryRecipient({ email: lookupKey });
        if (seeded) {
          return seeded;
        }

        return upsertRecipient({
          id: `pending:${lookupKey}`,
          ownerType: "external",
          claimStatus: "pending-claim",
          lookupKey
        });
      }

      if (input.agentId) {
        const existing = findRecipientByLookupKey(input.agentId);
        if (existing) {
          return structuredClone(existing);
        }

        const seeded = ensurePersistedDirectoryRecipient({ agentId: input.agentId });
        if (seeded) {
          return seeded;
        }

        throw new Error(`Unknown agent recipient: ${input.agentId}`);
      }

      if (input.walletAddress) {
        const lookupKey = normalizeWallet(input.walletAddress);
        const existing = findRecipientByLookupKey(lookupKey);
        if (existing) {
          return structuredClone(existing);
        }

        const seeded = ensurePersistedDirectoryRecipient({ walletAddress: lookupKey });
        if (seeded) {
          return seeded;
        }

        return upsertRecipient({
          id: `wallet:${lookupKey}`,
          ownerType: "external",
          walletAddress: lookupKey,
          claimStatus: "claimed",
          lookupKey
        });
      }

      throw new Error("Recipient resolution requires an email, agentId, or walletAddress");
    },
    getRecipient(id) {
      const recipient = recipients.get(id);
      return recipient ? structuredClone(recipient) : undefined;
    },
    getUserByPrivyUserId(privyUserId) {
      const user = [...users.values()].find((item) => item.privyUserId === privyUserId);
      return user ? structuredClone(user) : undefined;
    },
    async resolveOrCreatePrincipal(input) {
      if (repository?.resolveOrCreatePrincipal) {
        const resolution = await repository.resolveOrCreatePrincipal(input);
        users.set(resolution.user.id, structuredClone(resolution.user));
        return resolution;
      }

      const normEmail = input.email ? normalizeEmail(input.email) : undefined;
      const existingBySubject = [...users.values()].find(
        (u) => u.privyUserId === input.externalIdentity.subject
      );

      if (existingBySubject) {
        if (normEmail && existingBySubject.email !== normEmail) {
          existingBySubject.email = normEmail;
          users.set(existingBySubject.id, structuredClone(existingBySubject));
        }
        return {
          user: structuredClone(existingBySubject),
          created: false
        };
      }

      const user: UserRecord = {
        id: nextUserId(),
        email: normEmail ?? "",
        privyUserId: input.externalIdentity.subject,
        walletAddress: undefined
      };

      users.set(user.id, structuredClone(user));
      return {
        user: structuredClone(user),
        created: true
      };
    },
    async claimRecipient(recipientId, input) {
      const recipient = recipients.get(recipientId);

      if (!recipient) {
        throw new Error(`Unknown recipient: ${recipientId}`);
      }

      if (recipient.claimStatus !== "pending-claim") {
        return structuredClone(recipient);
      }

      const email = normalizeEmail(input.email ?? recipient.lookupKey);
      const provisioned =
        input.walletAddress || !provisioner
          ? undefined
          : await provisioner.provisionUserWallet({
              email,
              privyUserId: input.privyUserId
            });
      const walletAddress = normalizeWallet(
        input.walletAddress ?? provisioned?.walletAddress ?? ""
      );

      if (!walletAddress) {
        throw new Error(`Recipient ${recipientId} requires a wallet address`);
      }

      const existingUser =
        [...users.values()].find((user) => user.privyUserId === input.privyUserId) ??
        [...users.values()].find((user) => user.email === email);
      const user: UserRecord = existingUser
        ? {
            ...existingUser,
            email,
            privyUserId: input.privyUserId,
            walletAddress
          }
        : {
            id: nextUserId(),
            email,
            privyUserId: input.privyUserId,
            walletAddress
          };

      users.set(user.id, structuredClone(user));

      const claimedRecipient: ResolvedRecipient = {
        id: recipient.id,
        ownerType: "user",
        ownerId: input.privyUserId,
        walletAddress,
        claimStatus: "claimed",
        lookupKey: email
      };

      recipients.set(claimedRecipient.id, structuredClone(claimedRecipient));
      return structuredClone(claimedRecipient);
    },
    listRecipients: () => [...recipients.values()].map((recipient) => structuredClone(recipient)),
    createRecipient(input) {
      const id = input.id ?? `rcp_${randomBytes(8).toString("hex")}`;
      const now = new Date().toISOString();
      const normAddr = input.address ? normalizeWallet(input.address) : undefined;
      const recipient: ResolvedRecipient = {
        id,
        ownerType: "user",
        ownerId: input.ownerUserId,
        ownerUserId: input.ownerUserId,
        spaceId: input.spaceId,
        recipientType: input.recipientType,
        displayLabel: input.displayLabel,
        walletAddress: normAddr,
        claimStatus: normAddr ? "claimed" : "pending-claim",
        lookupKey: normAddr ?? input.displayLabel,
        status: input.status ?? "active",
        createdAt: now,
        updatedAt: now
      };
      recipients.set(id, structuredClone(recipient));
      return structuredClone(recipient);
    },
    listUsers: () => [...users.values()].map((user) => structuredClone(user)),
    exportState() {
      return {
        users: this.listUsers(),
        recipients: this.listRecipients()
      };
    },
    hydrate(state) {
      users.clear();
      recipients.clear();

      for (const user of state.users ?? []) {
        users.set(user.id, structuredClone(user));
      }

      for (const recipient of state.recipients ?? []) {
        recipients.set(recipient.id, structuredClone(recipient));
      }
    }
  };
};
