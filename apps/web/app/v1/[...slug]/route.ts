import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, encodeFunctionData, isAddress } from "viem";

export const dynamic = "force-dynamic";

const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;
const ERC20_TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
] as const;

function getNetworkConfig() {
  const isMainnet = process.env.ARC_NETWORK !== "testnet";
  const chainId = isMainnet ? 5042 : 5042002;
  const defaultRpc = isMainnet ? "https://rpc.mainnet.arc.io/" : "https://rpc.testnet.arc.network";
  const rpcUrl = isMainnet
    ? (process.env.ARC_MAINNET_RPC_URL || defaultRpc)
    : (process.env.ARC_TESTNET_RPC_URL || defaultRpc);

  return { isMainnet, chainId, rpcUrl, tokenAddress: ARC_USDC_ADDRESS };
}

// In-memory tenant store for serverless demo/session state
const memoryDb = {
  users: new Map<string, any>(),
  recipients: new Map<string, any[]>(),
  envelopes: new Map<string, any[]>(),
  intents: new Map<string, any[]>(),
  payments: new Map<string, any>(),
  submissions: new Map<string, any>(),
  challenges: new Map<string, any>()
};

function extractBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

function resolveUser(token: string) {
  // Deterministic user resolution from token or subject
  const sub = token.slice(0, 32);
  const userId = `usr_${Buffer.from(sub).toString("hex").slice(0, 16)}`;
  const spaceId = `spc_personal_${userId.slice(4)}`;

  if (!memoryDb.users.has(userId)) {
    const user = {
      id: userId,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    memoryDb.users.set(userId, user);
  }

  const user = memoryDb.users.get(userId);
  const space = {
    id: spaceId,
    name: "Personal Space",
    type: "personal",
    role: "owner",
    status: "active",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  return { user, space, sub };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const path = slug.join("/");
  const token = extractBearerToken(req);

  if (path === "me") {
    if (!token) {
      return NextResponse.json(
        { error: "unauthorized", code: "unauthorized", message: "Missing authorization token" },
        { status: 401 }
      );
    }

    const { user, space, sub } = resolveUser(token);
    return NextResponse.json({
      user,
      identities: [
        {
          provider: "privy",
          providerSubject: sub,
          verifiedAt: user.createdAt
        }
      ],
      personalSpace: space,
      activeSpace: space,
      wallets: []
    });
  }

  if (path === "balance") {
    const address = req.nextUrl.searchParams.get("address");
    const { chainId, rpcUrl, tokenAddress } = getNetworkConfig();

    if (!address || !isAddress(address)) {
      return NextResponse.json({
        asset: "USDC",
        amountBaseUnits: "0",
        amountDecimal: "0.000000",
        decimals: 6,
        chainId,
        tokenAddress
      });
    }

    try {
      const publicClient = createPublicClient({
        transport: http(rpcUrl)
      });

      const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`]
      });

      const baseUnits = BigInt(balance.toString());
      const whole = baseUnits / 1_000_000n;
      const frac = baseUnits % 1_000_000n;
      const amountDecimal = `${whole.toString()}.${frac.toString().padStart(6, "0")}`;

      return NextResponse.json({
        asset: "USDC",
        amountBaseUnits: baseUnits.toString(),
        amountDecimal,
        decimals: 6,
        chainId,
        tokenAddress
      });
    } catch (err) {
      return NextResponse.json({
        asset: "USDC",
        amountBaseUnits: "0",
        amountDecimal: "0.000000",
        decimals: 6,
        chainId,
        tokenAddress,
        error: err instanceof Error ? err.message : "rpc_error"
      });
    }
  }

  if (path === "spaces") {
    if (!token) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { space } = resolveUser(token);
    return NextResponse.json({ spaces: [space] });
  }

  if (path === "recipients") {
    if (!token) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { space } = resolveUser(token);
    const list = memoryDb.recipients.get(space.id) || [];
    return NextResponse.json(list);
  }

  if (path === "envelopes") {
    if (!token) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { space } = resolveUser(token);
    const list = memoryDb.envelopes.get(space.id) || [];
    return NextResponse.json(list);
  }

  if (path === "intents") {
    if (!token) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { space } = resolveUser(token);
    const list = memoryDb.intents.get(space.id) || [];
    return NextResponse.json(list);
  }

  if (path.startsWith("payments/")) {
    const paymentId = path.split("/")[1];
    const payment = memoryDb.payments.get(paymentId);
    if (!payment) {
      return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
    }
    return NextResponse.json({ payment });
  }

  if (path === "activity") {
    return NextResponse.json({
      activity: [
        {
          id: "act_init",
          type: "space.created",
          summary: "Microcosm Space initialized",
          createdAt: new Date().toISOString()
        }
      ]
    });
  }

  return NextResponse.json({ error: "route_not_found", path }, { status: 404 });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const path = slug.join("/");
  const token = extractBearerToken(req);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (path === "wallet/challenge") {
    const challengeId = `ch_${Date.now()}`;
    const challenge = {
      challengeId,
      message: `Sign to bind wallet to Microcosm: challenge_${challengeId}`,
      expiresAt: new Date(Date.now() + 300_000).toISOString()
    };
    memoryDb.challenges.set(challengeId, challenge);
    return NextResponse.json(challenge);
  }

  if (path === "wallet/verify") {
    return NextResponse.json({
      verified: true,
      address: body.address,
      linkedAt: new Date().toISOString()
    });
  }

  if (path === "recipients") {
    if (!token) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { space } = resolveUser(token);
    const recipient = {
      id: `rcp_${Date.now()}`,
      spaceId: space.id,
      name: body.name || "Recipient",
      destination: body.destination || body.address,
      createdAt: new Date().toISOString()
    };
    const list = memoryDb.recipients.get(space.id) || [];
    list.push(recipient);
    memoryDb.recipients.set(space.id, list);
    return NextResponse.json({ recipient }, { status: 201 });
  }

  if (path === "envelopes") {
    if (!token) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { space } = resolveUser(token);
    const envelope = {
      id: `env_${Date.now()}`,
      spaceId: space.id,
      name: body.name || "USDC Envelope",
      asset: "USDC",
      createdAt: new Date().toISOString()
    };
    const list = memoryDb.envelopes.get(space.id) || [];
    list.push(envelope);
    memoryDb.envelopes.set(space.id, list);
    return NextResponse.json({ envelope }, { status: 201 });
  }

  if (path === "intents") {
    if (!token) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { space } = resolveUser(token);
    const intent = {
      id: `int_${Date.now()}`,
      spaceId: space.id,
      recipient: body.recipient,
      amount: body.amount,
      amountBaseUnits: body.amountBaseUnits || "0",
      status: "approved",
      createdAt: new Date().toISOString()
    };
    const list = memoryDb.intents.get(space.id) || [];
    list.push(intent);
    memoryDb.intents.set(space.id, list);
    return NextResponse.json({ intent, evaluation: { approved: true } }, { status: 201 });
  }

  if (path === "payments/prepare") {
    const { chainId, tokenAddress } = getNetworkConfig();
    const paymentId = `pay_${Date.now()}`;
    const to = body.to || body.recipient || "0x0000000000000000000000000000000000000000";
    const amountBaseUnits = BigInt(body.amountBaseUnits || "0");

    let calldata = "0x";
    if (isAddress(to) && amountBaseUnits > 0n) {
      calldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [to as `0x${string}`, amountBaseUnits]
      });
    }

    const prepared = {
      paymentId,
      intentId: body.intentId || `int_${Date.now()}`,
      chainId,
      tokenAddress,
      to,
      amountBaseUnits: amountBaseUnits.toString(),
      calldata,
      value: "0",
      status: "prepared",
      createdAt: new Date().toISOString()
    };

    memoryDb.payments.set(paymentId, prepared);
    return NextResponse.json(prepared);
  }

  if (path.includes("/submission") || path === "payments/submission") {
    const paymentId = path.split("/")[1] || body.paymentId || `pay_${Date.now()}`;
    const submission = {
      paymentId,
      txHash: body.txHash,
      chainId: body.chainId || getNetworkConfig().chainId,
      senderAddress: body.senderAddress,
      status: "submitted",
      submittedAt: new Date().toISOString()
    };

    memoryDb.submissions.set(paymentId, submission);
    return NextResponse.json({ ok: true, submission });
  }

  if (path.includes("/confirm")) {
    const paymentId = path.split("/")[1];
    const submission = memoryDb.submissions.get(paymentId);
    const { chainId, rpcUrl, tokenAddress } = getNetworkConfig();

    if (!submission?.txHash) {
      return NextResponse.json({ error: "missing_tx_hash", message: "No transaction hash recorded for payment" }, { status: 400 });
    }

    try {
      const publicClient = createPublicClient({
        transport: http(rpcUrl)
      });

      const receipt = await publicClient.getTransactionReceipt({
        hash: submission.txHash as `0x${string}`
      });

      if (!receipt || receipt.status !== "success") {
        return NextResponse.json({
          ok: false,
          status: receipt ? "failed" : "pending",
          message: receipt ? "Transaction reverted onchain" : "Receipt pending block inclusion"
        });
      }

      return NextResponse.json({
        ok: true,
        payment: {
          id: paymentId,
          status: "confirmed",
          txHash: submission.txHash,
          blockNumber: receipt.blockNumber.toString(),
          blockHash: receipt.blockHash,
          chainId,
          tokenAddress
        }
      });
    } catch (err) {
      return NextResponse.json({
        ok: false,
        status: "pending",
        message: err instanceof Error ? err.message : "Receipt verification pending"
      });
    }
  }

  return NextResponse.json({ error: "route_not_found", path }, { status: 404 });
}
