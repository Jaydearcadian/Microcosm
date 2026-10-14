import type { PrivyClient, PrivyClientOptions } from "@privy-io/node";
import type { IdentityProvisioner } from "../../../identity/src/index.ts";

export type CreatePrivyAdapterInput = {
  appId?: string;
  appSecret?: string;
  apiUrl?: string;
  jwtVerificationKey?: string;
};

export type PrivyTokenClaims = {
  app_id: string;
  issuer: string;
  issued_at: number;
  expiration: number;
  session_id: string;
  user_id: string;
};

export type PrivyTokenVerifier = {
  verifyAccessToken: (token: string) => Promise<PrivyTokenClaims>;
};

export type PrivyAdapter = {
  id: "privy";
  kind: "identity";
  capabilities: readonly string[];
  config: Pick<PrivyClientOptions, "appId" | "appSecret" | "apiUrl" | "jwtVerificationKey">;
  createClient: () => Promise<PrivyClient>;
  verifyAccessToken: (token: string) => Promise<PrivyTokenClaims>;
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
  apiUrl,
  jwtVerificationKey
}: CreatePrivyAdapterInput): PrivyAdapter => {
  if (!appId || !appSecret) {
    throw new Error("Missing Privy app credentials");
  }

  const config: Pick<PrivyClientOptions, "appId" | "appSecret" | "apiUrl" | "jwtVerificationKey"> = {
    appId,
    appSecret,
    apiUrl,
    jwtVerificationKey
  };

  return {
    id: "privy",
    kind: "identity",
    capabilities: CAPABILITIES,
    config,
    createClient: async () => {
      const { PrivyClient } = await import("@privy-io/node");
      return new PrivyClient(config);
    },
    verifyAccessToken: async (token: string) => {
      const { PrivyClient } = await import("@privy-io/node");
      const client = new PrivyClient(config);
      return client.utils().auth().verifyAccessToken(token);
    }
  };
};

export const createPrivyTokenVerifier = (
  adapterOrOptions:
    | PrivyAdapter
    | { appId: string; jwtVerificationKey?: string; apiUrl?: string; appSecret?: string }
): PrivyTokenVerifier => {
  if ("verifyAccessToken" in adapterOrOptions) {
    return {
      verifyAccessToken: (token: string) => adapterOrOptions.verifyAccessToken(token)
    };
  }

  const clientPromise = (async () => {
    const { PrivyClient } = await import("@privy-io/node");
    return new PrivyClient({
      appId: adapterOrOptions.appId,
      appSecret: adapterOrOptions.appSecret ?? "unused_secret",
      apiUrl: adapterOrOptions.apiUrl,
      jwtVerificationKey: adapterOrOptions.jwtVerificationKey
    });
  })();

  return {
    async verifyAccessToken(token: string) {
      const client = await clientPromise;
      return client.utils().auth().verifyAccessToken(token);
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
