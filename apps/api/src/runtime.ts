export type ApiRuntimeConfig = {
  databaseUrl: string;
  privyAppId: string;
  privyAppSecret: string;
  arcSettlementPrivateKey: string;
  arcRpcUrl: string;
  arcContracts: {
    settlementRouter?: string;
    claimEscrow?: string;
  };
  port: number;
};

const requireEnv = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const getApiRuntimeConfig = (
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): ApiRuntimeConfig => ({
  databaseUrl: requireEnv("DATABASE_URL", env.DATABASE_URL),
  privyAppId: requireEnv("PRIVY_APP_ID", env.PRIVY_APP_ID),
  privyAppSecret: requireEnv("PRIVY_APP_SECRET", env.PRIVY_APP_SECRET),
  arcSettlementPrivateKey: requireEnv(
    "ARC_SETTLEMENT_PRIVATE_KEY",
    env.ARC_SETTLEMENT_PRIVATE_KEY ?? env.PRIVATE_KEY
  ),
  arcRpcUrl:
    env.ARC_NETWORK === "mainnet"
      ? requireEnv("ARC_MAINNET_RPC_URL", env.ARC_MAINNET_RPC_URL)
      : env.ARC_TESTNET_RPC_URL ?? "https://rpc.testnet.arc.network",
  arcContracts: {
    settlementRouter: env.ARC_SETTLEMENT_ROUTER_ADDRESS,
    claimEscrow: env.ARC_CLAIM_ESCROW_ADDRESS
  },
  port: Number(env.PORT ?? "3000")
});
