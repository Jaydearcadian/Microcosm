export type ApiRuntimeConfig = {
  databaseUrl: string;
  privyAppId: string;
  privyAppSecret: string;
  arcSettlementPrivateKey?: string;
  arcNetwork: "mainnet" | "testnet";
  arcChainId: number;
  arcRpcUrl: string;
  arcUsdcAddress: string;
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
): ApiRuntimeConfig => {
  const arcNetwork = env.ARC_NETWORK === "mainnet" ? "mainnet" : "testnet";
  const arcChainId = arcNetwork === "mainnet" ? 5042 : 5042002;
  const defaultRpc =
    arcNetwork === "mainnet"
      ? "https://rpc.mainnet.arc.io/"
      : "https://rpc.testnet.arc.network";
  const arcRpcUrl =
    arcNetwork === "mainnet"
      ? env.ARC_MAINNET_RPC_URL ?? defaultRpc
      : env.ARC_TESTNET_RPC_URL ?? defaultRpc;
  const arcUsdcAddress =
    env.ARC_USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000";

  return {
    databaseUrl: requireEnv("DATABASE_URL", env.DATABASE_URL),
    privyAppId: requireEnv("PRIVY_APP_ID", env.PRIVY_APP_ID),
    privyAppSecret: requireEnv("PRIVY_APP_SECRET", env.PRIVY_APP_SECRET),
    arcSettlementPrivateKey:
      env.ARC_SETTLEMENT_PRIVATE_KEY ?? env.PRIVATE_KEY ?? undefined,
    arcNetwork,
    arcChainId,
    arcRpcUrl,
    arcUsdcAddress,
    arcContracts: {
      settlementRouter: env.ARC_SETTLEMENT_ROUTER_ADDRESS,
      claimEscrow: env.ARC_CLAIM_ESCROW_ADDRESS
    },
    port: Number(env.PORT ?? "3000")
  };
};
