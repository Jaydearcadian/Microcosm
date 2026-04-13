export type SupportedMarketAdapter =
  | "myriad"
  | "polymarket"
  | "hyperliquid"
  | "lighter";

export type RuntimeConfigInput = Partial<Record<string, string | undefined>>;

export type RuntimeConfig = {
  arc: {
    network: "testnet" | "mainnet";
    rpcUrl: string;
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
  const network = env.ARC_NETWORK === "mainnet" ? "mainnet" : "testnet";
  const rpcUrl =
    network === "mainnet"
      ? env.ARC_MAINNET_RPC_URL
      : env.ARC_TESTNET_RPC_URL ?? "https://rpc.testnet.arc.network";

  if (!rpcUrl) {
    throw new Error("Missing Arc RPC URL");
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
      rpcUrl
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
