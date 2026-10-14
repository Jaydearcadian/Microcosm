export type SupportedMarketAdapter =
  | "myriad"
  | "polymarket"
  | "hyperliquid"
  | "lighter";

export type RuntimeConfigInput = Partial<Record<string, string | undefined>>;

export type RuntimeConfig = {
  arc: {
    network: "testnet" | "mainnet";
    chainId: number;
    rpcUrl: string;
    usdcAddress: string;
  };
  identity: {
    privyAppId?: string;
    privyAppSecret?: string;
    privyApiUrl?: string;
  };
  communications: {
    xmtpEnv: string;
    xmtpDbPath?: string;
    xmtpApiUrl?: string;
    xmtpHistorySyncUrl?: string;
  };
  data: {
    alliumApiKey?: string;
    alliumApiUrl?: string;
  };
  markets: {
    enabled: SupportedMarketAdapter[];
  };
};

const SUPPORTED_MARKET_ADAPTERS: SupportedMarketAdapter[] = [
  "myriad",
  "polymarket",
  "hyperliquid",
  "lighter"
];

export const createRuntimeConfig = (
  env: RuntimeConfigInput = process.env
): RuntimeConfig => {
  const rawNetwork = env.ARC_NETWORK ?? "testnet";
  if (rawNetwork !== "mainnet" && rawNetwork !== "testnet") {
    throw new Error(`Unsupported ARC_NETWORK: ${rawNetwork}. Must be 'mainnet' or 'testnet'.`);
  }
  const network = rawNetwork;
  const chainId = network === "mainnet" ? 5042 : 5042002;
  const defaultRpc =
    network === "mainnet"
      ? "https://rpc.mainnet.arc.io/"
      : "https://rpc.testnet.arc.network";
  const rpcUrl =
    network === "mainnet"
      ? env.ARC_MAINNET_RPC_URL ?? defaultRpc
      : env.ARC_TESTNET_RPC_URL ?? defaultRpc;
  const usdcAddress = env.ARC_USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000";

  if (!rpcUrl) {
    throw new Error("Missing Arc RPC URL");
  }

  if (env.ARC_CHAIN_ID && Number(env.ARC_CHAIN_ID) !== chainId) {
    throw new Error(
      `Configured ARC_CHAIN_ID ${env.ARC_CHAIN_ID} does not match network ${network} expected chain ID ${chainId}`
    );
  }

  const enabled = (env.ENABLED_MARKETS ?? "myriad,polymarket")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      if (
        !SUPPORTED_MARKET_ADAPTERS.includes(value as SupportedMarketAdapter)
      ) {
        throw new Error(`Unsupported market adapter: ${value}`);
      }

      return value as SupportedMarketAdapter;
    });

  return {
    arc: {
      network,
      chainId,
      rpcUrl,
      usdcAddress
    },
    identity: {
      privyAppId: env.PRIVY_APP_ID,
      privyAppSecret: env.PRIVY_APP_SECRET,
      privyApiUrl: env.PRIVY_API_URL
    },
    communications: {
      xmtpEnv: env.XMTP_ENV ?? "dev",
      xmtpDbPath: env.XMTP_DB_PATH,
      xmtpApiUrl: env.XMTP_API_URL,
      xmtpHistorySyncUrl: env.XMTP_HISTORY_SYNC_URL
    },
    data: {
      alliumApiKey: env.ALLIUM_API_KEY,
      alliumApiUrl: env.ALLIUM_API_URL
    },
    markets: {
      enabled
    }
  };
};
