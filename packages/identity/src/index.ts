import {
  resolveRecipient as resolveDirectoryRecipient,
  type RecipientDirectory,
  type RecipientResolutionInput,
  type ResolvedRecipient
} from "../../recipient-resolution/src/index.ts";

export type UserRecord = {
  id: string;
  email: string;
  privyUserId: string;
  walletAddress?: string;
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
};

export type IdentityService = {
  resolveRecipient: (input: RecipientResolutionInput) => ResolvedRecipient;
  getRecipient: (id: string) => ResolvedRecipient | undefined;
  getUserByPrivyUserId: (privyUserId: string) => UserRecord | undefined;
  claimRecipient: (
    recipientId: string,
    input: ClaimRecipientInput
  ) => Promise<ResolvedRecipient>;
  listRecipients: () => ResolvedRecipient[];
  listUsers: () => UserRecord[];
  exportState: () => IdentityState;
  hydrate: (state: Partial<IdentityState>) => void;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeWallet = (walletAddress: string) => walletAddress.toLowerCase();

export const createIdentityService = ({
  directory = {},
  provisioner
}: {
  directory?: RecipientDirectory;
  provisioner?: IdentityProvisioner;
} = {}): IdentityService => {
  const users = new Map<string, UserRecord>();
  const recipients = new Map<string, ResolvedRecipient>();

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
