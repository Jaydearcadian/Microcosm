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
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "expiresAt", type: "uint64" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "paymentIdHash", type: "bytes32" }],
    outputs: []
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "paymentIdHash", type: "bytes32" }],
    outputs: []
  },
  {
    type: "event",
    name: "EscrowCreated",
    inputs: [
      { indexed: true, name: "paymentIdHash", type: "bytes32" },
      { indexed: true, name: "token", type: "address" },
      { indexed: true, name: "depositor", type: "address" },
      { indexed: false, name: "recipient", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "expiresAt", type: "uint64" }
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
  },
  {
    type: "event",
    name: "EscrowRefunded",
    inputs: [
      { indexed: true, name: "paymentIdHash", type: "bytes32" },
      { indexed: true, name: "depositor", type: "address" },
      { indexed: false, name: "amount", type: "uint256" }
    ]
  }
] as const;

export const envelopeAbi = [
  {
    type: "function",
    name: "executePayment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "paymentId", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  }
] as const;

/**
 * `executePayment(bytes32,address,uint256)` selector, computed with
 * ethers.utils.id("executePayment(bytes32,address,uint256)") — verified
 * against viem's encodeFunctionData in the adapter test suite.
 */
export const ENVELOPE_EXECUTE_SELECTOR = "0xa97274c2";

const pad32 = (hex: string) => hex.toLowerCase().replace(/^0x/, "").padStart(64, "0");

/**
 * Build envelope-mode calldata without a runtime ABI encoder dependency.
 * The API's /v1/payments/prepare and any client-side path MUST share this
 * encoding so the paymentId replay guard matches between preparation and
 * execution (the contract treats paymentId as an opaque bytes32 key).
 */
export const encodeEnvelopeExecutePayment = (input: {
  paymentIdHash: string;
  recipient: string;
  amountBaseUnits: bigint | string;
}) =>
  `${ENVELOPE_EXECUTE_SELECTOR}${pad32(input.paymentIdHash)}${pad32(
    input.recipient
  )}${pad32(BigInt(input.amountBaseUnits).toString(16))}`;

/** keccak256("EnvelopeCreated(address,address,address,uint256)") */
export const ENVELOPE_CREATED_TOPIC =
  "0x190903af5d1895480c8bf1a0a1d1d3733e59b9f42bc1d33676c13096db7945aa";

export const envelopeFactoryAbi = [
  {
    type: "function",
    name: "createEnvelope",
    stateMutability: "nonpayable",
    inputs: [
      { name: "maxPerTransaction", type: "uint256" },
      { name: "maxPerDay", type: "uint256" },
      { name: "automaticApprovalLimit", type: "uint256" },
      { name: "allowedDaysMask", type: "uint8" },
      { name: "startHourUtc", type: "uint8" },
      { name: "endHourUtc", type: "uint8" },
      { name: "recipientAllowlistEnabled", type: "bool" },
      { name: "initialRecipients", type: "address[]" },
      { name: "initialOperators", type: "address[]" }
    ],
    outputs: [{ name: "envelopeAddress", type: "address" }]
  },
  {
    type: "event",
    name: "EnvelopeCreated",
    inputs: [
      { indexed: true, name: "envelope", type: "address" },
      { indexed: true, name: "owner", type: "address" },
      { indexed: true, name: "token", type: "address" },
      { indexed: false, name: "index", type: "uint256" }
    ]
  }
] as const;

type ArcContractsConfig = {
  settlementRouter?: string;
  claimEscrow?: string;
  envelopeFactory?: string;
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
    recipient: string;
    expiresAt: bigint | number;
    tokenAddress?: string;
  }) => Promise<string>;
  claimEscrow: (input: { paymentId: string }) => Promise<string>;
  refundEscrow: (input: { paymentId: string }) => Promise<string>;
  executeEnvelopePayment: (input: {
    paymentId: string;
    amount: string;
    recipient: string;
    envelopeAddress: string;
  }) => Promise<string>;
  createEnvelope: (input: {
    /** USDC decimal strings, parsed to 6-decimal base units internally */
    maxPerTransaction: string;
    maxPerDay: string;
    automaticApprovalLimit: string;
    allowedDaysMask: number;
    startHourUtc: number;
    endHourUtc: number;
    recipientAllowlistEnabled: boolean;
    initialRecipients?: string[];
    initialOperators?: string[];
    factoryAddress?: string;
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

export const paymentIdHash = (paymentId: string) =>
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
      recipient,
      expiresAt,
      tokenAddress = ARC_USDC_ADDRESS
    }) {
      const txHash = await (await ensureWalletClient()).writeContract({
        address: requireContract(contracts.claimEscrow, "claimEscrow"),
        abi: claimEscrowAbi,
        functionName: "createEscrow",
        args: [
          paymentIdHash(paymentId),
          tokenAddress,
          recipient,
          parseUsdcUnits(amount),
          typeof expiresAt === "bigint" ? expiresAt : BigInt(expiresAt)
        ]
      });
      return String(txHash);
    },
    async claimEscrow({ paymentId }) {
      const txHash = await (await ensureWalletClient()).writeContract({
        address: requireContract(contracts.claimEscrow, "claimEscrow"),
        abi: claimEscrowAbi,
        functionName: "claim",
        args: [paymentIdHash(paymentId)]
      });
      return String(txHash);
    },
    async refundEscrow({ paymentId }) {
      const txHash = await (await ensureWalletClient()).writeContract({
        address: requireContract(contracts.claimEscrow, "claimEscrow"),
        abi: claimEscrowAbi,
        functionName: "refund",
        args: [paymentIdHash(paymentId)]
      });
      return String(txHash);
    },
    async executeEnvelopePayment({ paymentId, amount, recipient, envelopeAddress }) {
      const txHash = await (await ensureWalletClient()).writeContract({
        address: envelopeAddress as `0x${string}`,
        abi: envelopeAbi,
        functionName: "executePayment",
        args: [paymentIdHash(paymentId), recipient, parseUsdcUnits(amount)]
      });
      return String(txHash);
    },
    async createEnvelope({
      maxPerTransaction,
      maxPerDay,
      automaticApprovalLimit,
      allowedDaysMask,
      startHourUtc,
      endHourUtc,
      recipientAllowlistEnabled,
      initialRecipients = [],
      initialOperators = [],
      factoryAddress
    }) {
      const txHash = await (await ensureWalletClient()).writeContract({
        address: requireContract(
          factoryAddress ?? contracts.envelopeFactory,
          "envelopeFactory"
        ),
        abi: envelopeFactoryAbi,
        functionName: "createEnvelope",
        args: [
          parseUsdcUnits(maxPerTransaction),
          parseUsdcUnits(maxPerDay),
          parseUsdcUnits(automaticApprovalLimit),
          allowedDaysMask,
          startHourUtc,
          endHourUtc,
          recipientAllowlistEnabled,
          initialRecipients,
          initialOperators
        ]
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

export const ERC20_TRANSFER_EVENT_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export type VerifyUsdcTransferInput = {
  txHash: string;
  expectedChainId?: number;
  tokenAddress?: string;
  from?: string;
  to: string;
  amountBaseUnits: bigint;
};

export type VerifyUsdcTransferResult = {
  status: "pending" | "confirmed" | "failed" | "mismatch";
  blockNumber?: string;
  blockHash?: string;
  observedTransfer?: { from: string; to: string; amountBaseUnits: string };
  reason?: string;
};

export const verifyUsdcTransfer = async (
  publicClient: PublicClientLike,
  input: VerifyUsdcTransferInput
): Promise<VerifyUsdcTransferResult> => {
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: input.txHash });
    if (!receipt) {
      return { status: "pending", reason: "receipt_not_found_yet" };
    }

    if (
      receipt.status === "reverted" ||
      receipt.status === "0x0" ||
      (receipt as any).status === 0
    ) {
      return { status: "failed", reason: "transaction_reverted" };
    }

    if (
      receipt.status !== "success" &&
      receipt.status !== "0x1" &&
      (receipt as any).status !== 1
    ) {
      return { status: "pending", reason: "receipt_pending_or_unconfirmed" };
    }

    const logs = (receipt as any).logs || [];
    const expectedToken = (input.tokenAddress || ARC_USDC_ADDRESS).toLowerCase();
    const expectedTo = input.to.toLowerCase();
    const expectedFrom = input.from?.toLowerCase();

    // Find Transfer log for expected token
    const transferLogs = logs.filter((l: any) => {
      const address = String(l.address || "").toLowerCase();
      const topics = l.topics || [];
      return (
        address === expectedToken &&
        topics[0]?.toLowerCase() === ERC20_TRANSFER_EVENT_TOPIC.toLowerCase()
      );
    });

    if (transferLogs.length === 0) {
      return {
        status: "mismatch",
        reason: "no_erc20_transfer_log_for_token",
        blockNumber: (receipt as any).blockNumber?.toString(),
        blockHash: receipt.blockHash ?? undefined
      };
    }

    // Inspect transfer log parameters
    for (const log of transferLogs) {
      const topics = log.topics || [];
      const logFrom = topics[1] ? `0x${topics[1].slice(-40)}`.toLowerCase() : "";
      const logTo = topics[2] ? `0x${topics[2].slice(-40)}`.toLowerCase() : "";
      const logAmount = log.data && log.data !== "0x" ? BigInt(log.data) : 0n;

      if (logTo === expectedTo) {
        if (expectedFrom && logFrom !== expectedFrom) {
          return {
            status: "mismatch",
            reason: `sender_mismatch: observed=${logFrom}, expected=${expectedFrom}`,
            blockNumber: (receipt as any).blockNumber?.toString(),
            blockHash: receipt.blockHash ?? undefined,
            observedTransfer: {
              from: logFrom,
              to: logTo,
              amountBaseUnits: logAmount.toString()
            }
          };
        }

        if (logAmount !== input.amountBaseUnits) {
          return {
            status: "mismatch",
            reason: `amount_mismatch: observed=${logAmount.toString()}, expected=${input.amountBaseUnits.toString()}`,
            blockNumber: (receipt as any).blockNumber?.toString(),
            blockHash: receipt.blockHash ?? undefined,
            observedTransfer: {
              from: logFrom,
              to: logTo,
              amountBaseUnits: logAmount.toString()
            }
          };
        }

        return {
          status: "confirmed",
          blockNumber: (receipt as any).blockNumber?.toString(),
          blockHash: receipt.blockHash ?? undefined,
          observedTransfer: {
            from: logFrom,
            to: logTo,
            amountBaseUnits: logAmount.toString()
          }
        };
      }
    }

    return {
      status: "mismatch",
      reason: "recipient_mismatch_in_transfer_logs",
      blockNumber: (receipt as any).blockNumber?.toString(),
      blockHash: receipt.blockHash ?? undefined
    };
  } catch (error) {
    return {
      status: "pending",
      reason: error instanceof Error ? error.message : "rpc_lookup_error"
    };
  }
};

