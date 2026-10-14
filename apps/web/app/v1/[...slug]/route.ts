import { NextRequest, NextResponse } from "next/server.js";
import { createPublicClient, http, isAddress } from "viem";

export const dynamic = "force-dynamic";

const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
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

/**
 * Handle onchain balance reads.
 * Fails closed: rejects invalid addresses with 400, and returns 503 on RPC failures.
 * Never returns a fabricated zero balance on error.
 */
async function handleBalanceRead(req: NextRequest): Promise<NextResponse> {
  const address = req.nextUrl.searchParams.get("address");
  const { chainId, rpcUrl, tokenAddress } = getNetworkConfig();

  if (!address) {
    // If MICROCOSM_API_PROXY is configured, let upstream resolve from authenticated session
    if (process.env.MICROCOSM_API_PROXY) {
      return proxyToSecuredApi(req, "balance");
    }
    return NextResponse.json(
      { error: "missing_address", message: "Query parameter 'address' is required to read onchain balance" },
      { status: 400 }
    );
  }

  if (!isAddress(address)) {
    return NextResponse.json(
      { error: "invalid_address", message: `Address '${address}' is not a valid EVM address` },
      { status: 400 }
    );
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
    return NextResponse.json(
      {
        error: "rpc_unavailable",
        message: err instanceof Error ? err.message : "Failed to read onchain balance from Arc RPC",
        chainId,
        tokenAddress
      },
      { status: 503 }
    );
  }
}

/**
 * Proxy request to the authoritative, secured Microcosm API backend.
 * Fails closed if MICROCOSM_API_PROXY is not configured or upstream is unreachable.
 * Forwards authorization, headers, query string, and body without caching.
 */
async function proxyToSecuredApi(req: NextRequest, path: string): Promise<NextResponse> {
  const proxyBaseUrl = process.env.MICROCOSM_API_PROXY;

  if (!proxyBaseUrl || proxyBaseUrl.trim() === "") {
    return NextResponse.json(
      {
        error: "api_gateway_unconfigured",
        code: "api_gateway_unconfigured",
        message: "Microcosm secured API proxy upstream is not configured. Set MICROCOSM_API_PROXY."
      },
      { status: 503 }
    );
  }

  const targetUrl = `${proxyBaseUrl.replace(/\/+$/, "")}/v1/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  const hopByHopHeaders = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-length",
    "host"
  ]);

  for (const [key, value] of req.headers.entries()) {
    if (!hopByHopHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      body = await req.text();
    } catch {
      body = undefined;
    }
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    });

    const responseHeaders = new Headers();
    for (const [key, value] of upstreamRes.headers.entries()) {
      if (!hopByHopHeaders.has(key.toLowerCase()) && key.toLowerCase() !== "content-encoding") {
        responseHeaders.set(key, value);
      }
    }

    const responseBody = await upstreamRes.text();
    return new NextResponse(responseBody, {
      status: upstreamRes.status,
      headers: responseHeaders
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "api_upstream_unavailable",
        code: "api_upstream_unavailable",
        message: err instanceof Error ? err.message : "Microcosm secured API upstream is unreachable"
      },
      { status: 503 }
    );
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const path = slug.join("/");

  if (path === "balance") {
    return handleBalanceRead(req);
  }

  return proxyToSecuredApi(req, path);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const path = slug.join("/");

  return proxyToSecuredApi(req, path);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const path = slug.join("/");

  return proxyToSecuredApi(req, path);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const path = slug.join("/");

  return proxyToSecuredApi(req, path);
}
