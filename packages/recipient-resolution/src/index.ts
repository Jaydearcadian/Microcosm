export type ResolvedRecipient = {
  id: string;
  ownerType: "user" | "agent" | "organization" | "external";
  ownerId?: string;
  walletAddress?: string;
  claimStatus: "claimed" | "pending-claim";
  lookupKey: string;
};

export type RecipientResolutionInput = {
  email?: string;
  agentId?: string;
  walletAddress?: string;
};

export type RecipientDirectory = {
  emails?: Record<string, Omit<ResolvedRecipient, "lookupKey">>;
  agents?: Record<string, Omit<ResolvedRecipient, "lookupKey">>;
  wallets?: Record<string, Omit<ResolvedRecipient, "lookupKey">>;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const resolveRecipient = (
  input: RecipientResolutionInput,
  directory: RecipientDirectory
): ResolvedRecipient => {
  if (input.email) {
    const lookupKey = normalizeEmail(input.email);
    const existing = directory.emails?.[lookupKey];

    if (existing) {
      return {
        ...existing,
        lookupKey
      };
    }

    return {
      id: `pending:${lookupKey}`,
      ownerType: "external",
      claimStatus: "pending-claim",
      lookupKey
    };
  }

  if (input.agentId) {
    const lookupKey = input.agentId;
    const existing = directory.agents?.[lookupKey];

    if (!existing) {
      throw new Error(`Unknown agent recipient: ${lookupKey}`);
    }

    return {
      ...existing,
      lookupKey
    };
  }

  if (input.walletAddress) {
    const lookupKey = input.walletAddress.toLowerCase();
    const existing = directory.wallets?.[lookupKey];

    if (existing) {
      return {
        ...existing,
        lookupKey
      };
    }

    return {
      id: `wallet:${lookupKey}`,
      ownerType: "external",
      walletAddress: lookupKey,
      claimStatus: "claimed",
      lookupKey
    };
  }

  throw new Error("Recipient resolution requires an email, agentId, or walletAddress");
};
