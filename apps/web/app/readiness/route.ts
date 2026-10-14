import { NextResponse } from "next/server.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const isMainnet = process.env.ARC_NETWORK !== "testnet";
  const expectedChainId = isMainnet ? 5042 : 5042002;
  const defaultRpc = isMainnet ? "https://rpc.mainnet.arc.io/" : "https://rpc.testnet.arc.network";
  const rpcUrl = isMainnet
    ? (process.env.ARC_MAINNET_RPC_URL || defaultRpc)
    : (process.env.ARC_TESTNET_RPC_URL || defaultRpc);

  // 1. Check Arc RPC connectivity & Chain ID
  let rpcStatus = "ok";
  let observedChainId: number | null = null;
  let rpcError: string | null = null;

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: []
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) {
      rpcStatus = "error";
      rpcError = `HTTP_${res.status}`;
    } else {
      const data = (await res.json()) as { result?: string; error?: unknown };
      if (data.result) {
        observedChainId = parseInt(data.result, 16);
        if (observedChainId !== expectedChainId) {
          rpcStatus = "mismatch";
          rpcError = `Chain ID mismatch: expected ${expectedChainId}, observed ${observedChainId}`;
        }
      } else {
        rpcStatus = "error";
        rpcError = "Missing result in JSON-RPC response";
      }
    }
  } catch (err) {
    rpcStatus = "error";
    rpcError = err instanceof Error ? err.message : "rpc_fetch_failed";
  }

type UpstreamHealthReport = {
  status?: string;
  service?: string;
  expectedChainId?: number;
  observedChainId?: number;
  checks?: Array<{ name: string; status: string; detail?: string; expectedChainId?: number; observedChainId?: number }>;
};

  // 2. Check Secured API upstream connectivity via MICROCOSM_API_PROXY (/readyz)
  const proxyUrl = process.env.MICROCOSM_API_PROXY;
  let apiProxyStatus = "not_configured";
  let apiProxyOrigin: string | null = null;
  let apiProxyError: string | null = null;
  let upstreamReport: UpstreamHealthReport | null = null;

  if (proxyUrl && proxyUrl.trim().length > 0) {
    try {
      const u = new URL(proxyUrl);
      apiProxyOrigin = u.origin;
      const res = await fetch(`${u.origin}/readyz`, {
        signal: AbortSignal.timeout(5000)
      });
      const data = (await res.json().catch(() => null)) as UpstreamHealthReport | null;
      upstreamReport = data;

      if (!res.ok) {
        apiProxyStatus = "degraded";
        apiProxyError = `upstream_http_${res.status}`;
      } else if (!data || typeof data !== "object" || data.status !== "ok") {
        apiProxyStatus = "degraded";
        apiProxyError = "upstream_status_degraded";
      } else if (data.expectedChainId !== expectedChainId) {
        apiProxyStatus = "chain_mismatch";
        apiProxyError = `upstream_expected_chain_mismatch: upstream=${data.expectedChainId}, gateway=${expectedChainId}`;
      } else if (data.observedChainId !== expectedChainId) {
        apiProxyStatus = "chain_mismatch";
        apiProxyError = `upstream_observed_chain_mismatch: upstream=${data.observedChainId}, gateway=${expectedChainId}`;
      } else if (!Array.isArray(data.checks)) {
        apiProxyStatus = "degraded";
        apiProxyError = "upstream_missing_checks";
      } else {
        const requiredChecks = ["postgres", "arc_rpc", "privy"];
        const missingOrFailingCheck = requiredChecks.find((checkName) => {
          const check = data.checks?.find((c) => c && c.name === checkName);
          return !check || check.status !== "ok";
        });

        if (missingOrFailingCheck) {
          apiProxyStatus = "degraded";
          apiProxyError = `upstream_check_failed: ${missingOrFailingCheck}`;
        } else {
          apiProxyStatus = "ok";
        }
      }
    } catch (err) {
      apiProxyStatus = "unreachable";
      apiProxyError = err instanceof Error ? err.message : "upstream_fetch_failed";
    }
  }

  const isRpcReady = rpcStatus === "ok";
  const isApiReady = apiProxyStatus === "ok";
  const isOverallReady = isRpcReady && isApiReady;

  return NextResponse.json(
    {
      status: isOverallReady ? "ready" : "degraded",
      scope: "application",
      arcRpc: {
        network: isMainnet ? "mainnet" : "testnet",
        expectedChainId,
        observedChainId,
        status: rpcStatus,
        error: rpcError,
        usdcAddress: "0x3600000000000000000000000000000000000000"
      },
      apiUpstream: {
        configured: Boolean(proxyUrl && proxyUrl.trim().length > 0),
        origin: apiProxyOrigin,
        status: apiProxyStatus,
        expectedChainId: upstreamReport?.expectedChainId,
        observedChainId: upstreamReport?.observedChainId,
        checks: upstreamReport?.checks ?? null,
        error: apiProxyError
      },
      timestamp: new Date().toISOString()
    },
    { status: isOverallReady ? 200 : 503 }
  );
}
