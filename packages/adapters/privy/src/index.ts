import type { PrivyClient, PrivyClientOptions } from "@privy-io/node";
import type { IdentityProvisioner } from "../../../identity/src/index.ts";

export type CreatePrivyAdapterInput = {
  appId?: string;
  appSecret?: string;
  apiUrl?: string;
};

export type PrivyAdapter = {
  id: "privy";
  kind: "identity";
  capabilities: readonly string[];
  config: Pick<PrivyClientOptions, "appId" | "appSecret" | "apiUrl">;
  createClient: () => Promise<PrivyClient>;
};

export type PrivyProvisioner = IdentityProvisioner;

const CAPABILITIES = [
  "embedded-wallets",
  "wallet-pregeneration",
  "server-wallets",
  "linked-identities"
] as const;

export const createPrivyAdapter = ({
  appId,
  appSecret,
  apiUrl
}: CreatePrivyAdapterInput): PrivyAdapter => {
  if (!appId || !appSecret) {
    throw new Error("Missing Privy app credentials");
  }

  const config: Pick<PrivyClientOptions, "appId" | "appSecret" | "apiUrl"> = {
    appId,
    appSecret,
    apiUrl
  };

  return {
    id: "privy",
    kind: "identity",
    capabilities: CAPABILITIES,
    config,
    createClient: async () => {
      const { PrivyClient } = await import("@privy-io/node");
      return new PrivyClient(config);
    }
  };
};

const toExternalId = (email: string) =>
  email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 64);

export const createPrivyProvisioner = (
  adapter: PrivyAdapter
): PrivyProvisioner => ({
  async provisionUserWallet({ email, privyUserId, walletAddress }) {
    if (walletAddress) {
      return {
        walletAddress: walletAddress.toLowerCase()
      };
    }

    const client = await adapter.createClient();
    const wallet = await client.wallets().create({
      chain_type: "ethereum",
      owner: {
        user_id: privyUserId
      },
      external_id: toExternalId(email)
    });

    return {
      walletAddress: wallet.address.toLowerCase(),
      walletId: wallet.id
    };
  }
});
