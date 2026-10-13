export const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
export const ARC_CHAIN = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"]
    }
  }
} as const;

export const settlementRouterAbi = [
  {
    type: "function",
    name: "settleDirect",
    stateMutability: "nonpayable",
    inputs: [
      { name: "paymentIdHash", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "settlementId", type: "bytes32" }]
  },
  {
    type: "event",
    name: "DirectSettlementRecorded",
    inputs: [
      { indexed: true, name: "paymentIdHash", type: "bytes32" },
      { indexed: true, name: "token", type: "address" },
      { indexed: true, name: "payer", type: "address" },
      { indexed: false, name: "recipient", type: "address" },
      { indexed: false, name: "amount", type: "uint256" }
    ]
  }
] as const;

export const claimEscrowAbi = [
  {
    type: "function",
    name: "createEscrow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "paymentIdHash", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "lookupKey", type: "string" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "paymentIdHash", type: "bytes32" },
      { name: "recipient", type: "address" }
    ],
    outputs: []
  },
  {
    type: "event",
    name: "EscrowCreated",
    inputs: [
      { indexed: true, name: "paymentIdHash", type: "bytes32" },
      { indexed: true, name: "token", type: "address" },
      { indexed: true, name: "depositor", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "lookupKey", type: "string" }
    ]
  },
  {
    type: "event",
    name: "EscrowClaimed",
    inputs: [
      { indexed: true, name: "paymentIdHash", type: "bytes32" },
      { indexed: true, name: "recipient", type: "address" },
      { indexed: false, name: "amount", type: "uint256" }
    ]
  }
] as const;

type ArcContractsConfig = {
  settlementRouter?: string;
  claimEscrow?: string;
};

type WalletClientLike = {
  writeContract: (input: Record<string, unknown>) => Promise<`0x${string}` | string>;
};

type PublicClientLike = {
  getTransactionReceipt: (
    input: Record<string, unknown>
  ) => Promise<{ status?: string; blockHash?: string | null }>;
  getLogs: (input: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
};

export type ArcContractClient = {
  settleDirect: (input: {
    paymentId: string;
    amount: string;
    recipient: string;
    tokenAddress?: string;
  }) => Promise<string>;
  createClaimEscrow: (input: {
    paymentId: string;
    amount: string;
    lookupKey: string;
    tokenAddress?: string;
  }) => Promise<string>;
  claimEscrow: (input: {
    paymentId: string;
    recipient: string;
  }) => Promise<string>;
  confirmTransaction: (
    txHash: string
  ) => Promise<{ confirmed: boolean; checkedAt: string }>;
  getDirectSettlementEvents: () => Promise<Array<Record<string, unknown>>>;
};

export const arcAdapter = {
  id: "arc",
  kind: "settlement",
  network: "arc",
  chainId: 5042002,
  rpcUrl: "https://rpc.testnet.arc.network",
  asset: "USDC"
} as const;

const paymentIdHash = (paymentId: string) =>
  `0x${Buffer.from(paymentId, "utf8")
    .toString("hex")
    .padEnd(64, "0")
    .slice(0, 64)}` as `0x${string}`;

const parseUsdcUnits = (amount: string) => {
  const [whole, fraction = ""] = amount.split(".");
  const normalizedWhole = BigInt(whole || "0");
  const normalizedFraction = BigInt((fraction.padEnd(6, "0").slice(0, 6)) || "0");
  return normalizedWhole * 1_000_000n + normalizedFraction;
};

const importWorkspaceModule = async (modulePath: string): Promise<any> =>
  import(modulePath);

export const createArcContractClient = ({
  privateKey,
  rpcUrl = arcAdapter.rpcUrl,
  contracts,
  walletClient,
  publicClient
}: {
  privateKey: string;
  rpcUrl?: string;
  contracts: ArcContractsConfig;
  walletClient?: WalletClientLike;
  publicClient?: PublicClientLike;
}): ArcContractClient => {
  let resolvedWalletClient = walletClient;
  let resolvedPublicClient = publicClient;

  const ensureWalletClient = async () => {
    if (resolvedWalletClient) {
      return resolvedWalletClient;
    }

    const [{ createWalletClient }, { http }] = await Promise.all([
      importWorkspaceModule(
        "../../../../node_modules/viem/_esm/clients/createWalletClient.js"
      ),
      importWorkspaceModule(
        "../../../../node_modules/viem/_esm/clients/transports/http.js"
      )
    ]);
    const { privateKeyToAccount } = await importWorkspaceModule(
      "../../../../node_modules/viem/_esm/accounts/privateKeyToAccount.js"
    );

    resolvedWalletClient = createWalletClient({
      account: privateKeyToAccount(privateKey as `0x${string}`),
      chain: ARC_CHAIN,
      transport: http(rpcUrl)
    }) as WalletClientLike;
    return resolvedWalletClient;
  };

  const ensurePublicClient = async () => {
    if (resolvedPublicClient) {
      return resolvedPublicClient;
    }

    const [{ createPublicClient }, { http }] = await Promise.all([
      importWorkspaceModule(
        "../../../../node_modules/viem/_esm/clients/createPublicClient.js"
      ),
      importWorkspaceModule(
        "../../../../node_modules/viem/_esm/clients/transports/http.js"
      )
    ]);

    resolvedPublicClient = createPublicClient({
      chain: ARC_CHAIN,
      transport: http(rpcUrl)
    }) as PublicClientLike;
    return resolvedPublicClient;
  };

  const requireContract = (value: string | undefined, name: string) => {
    if (!value) {
      throw new Error(`Missing Arc contract address: ${name}`);
    }
    return value as `0x${string}`;
  };

  return {
    async settleDirect({ paymentId, amount, recipient, tokenAddress = ARC_USDC_ADDRESS }) {
      const txHash = await (await ensureWalletClient()).writeContract({
        address: requireContract(contracts.settlementRouter, "settlementRouter"),
        abi: settlementRouterAbi,
        functionName: "settleDirect",
        args: [
          paymentIdHash(paymentId),
          tokenAddress,
          recipient,
          parseUsdcUnits(amount)
        ]
      });
      return String(txHash);
    },
    async createClaimEscrow({
      paymentId,
      amount,
      lookupKey,
      tokenAddress = ARC_USDC_ADDRESS
    }) {
      const txHash = await (await ensureWalletClient()).writeContract({
        address: requireContract(contracts.claimEscrow, "claimEscrow"),
        abi: claimEscrowAbi,
        functionName: "createEscrow",
        args: [paymentIdHash(paymentId), tokenAddress, parseUsdcUnits(amount), lookupKey]
      });
      return String(txHash);
    },
    async claimEscrow({ paymentId, recipient }) {
      const txHash = await (await ensureWalletClient()).writeContract({
        address: requireContract(contracts.claimEscrow, "claimEscrow"),
        abi: claimEscrowAbi,
        functionName: "claim",
        args: [paymentIdHash(paymentId), recipient]
      });
      return String(txHash);
    },
    async confirmTransaction(txHash) {
      const receipt = await (await ensurePublicClient()).getTransactionReceipt({
        hash: txHash
      });
      return {
        confirmed: receipt.status === "success" && !!receipt.blockHash,
        checkedAt: new Date().toISOString()
      };
    },
    async getDirectSettlementEvents() {
      const logs = await (await ensurePublicClient()).getLogs({
        address: requireContract(contracts.settlementRouter, "settlementRouter")
      });

      return logs.map((log) => ({ ...log }));
    }
  };
};
