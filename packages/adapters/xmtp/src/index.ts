import type { Client, ClientOptions, Signer } from "@xmtp/node-sdk";

export type XmtpEnv =
  | "local"
  | "dev"
  | "production"
  | "testnet-staging"
  | "testnet-dev"
  | "testnet"
  | "mainnet";

export type CreateXmtpAdapterInput = {
  env?: XmtpEnv;
  dbPath?: string | null;
  apiUrl?: string;
  historySyncUrl?: string | null;
};

export type XmtpAdapter = {
  id: "xmtp";
  kind: "communications";
  capabilities: readonly string[];
  config: CreateXmtpAdapterInput & { env: XmtpEnv };
  createClient: (signer: Signer) => Promise<Client<unknown>>;
};

const CAPABILITIES = [
  "agent-messaging",
  "recipient-notifications",
  "content-types"
] as const;

export const createXmtpAdapter = (
  input: CreateXmtpAdapterInput
): XmtpAdapter => {
  const config = {
    env: input.env ?? "dev",
    dbPath: input.dbPath,
    apiUrl: input.apiUrl,
    historySyncUrl: input.historySyncUrl
  };

  return {
    id: "xmtp",
    kind: "communications",
    capabilities: CAPABILITIES,
    config,
    createClient: async (signer) => {
      const { Client } = await import("@xmtp/node-sdk");
      const options: ClientOptions = {
        env: config.env,
        dbPath: config.dbPath,
        apiUrl: config.apiUrl,
        historySyncUrl: config.historySyncUrl
      };

      return Client.create(signer, options);
    }
  };
};
