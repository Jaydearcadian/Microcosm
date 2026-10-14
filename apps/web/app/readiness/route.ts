import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const isMainnet = process.env.ARC_NETWORK !== "testnet";
  const expectedChainId = isMainnet ? 5042 : 5042002;
  const defaultRpc = isMainnet ? "https://rpc.mainnet.arc.io/" : "https://rpc.testnet.arc.network";
  const rpcUrl = isMainnet
    ? (process.env.ARC_MAINNET_RPC_URL || defaultRpc)
    : (process.env.ARC_TESTNET_RPC_URL || defaultRpc);

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

  const isReady = rpcStatus === "ok";

  return NextResponse.json(
    {
      status: isReady ? "ready" : "degraded",
      network: isMainnet ? "mainnet" : "testnet",
      expectedChainId,
      observedChainId,
      rpcStatus,
      rpcError,
      usdcAddress: "0x3600000000000000000000000000000000000000",
      timestamp: new Date().toISOString()
    },
    { status: isReady ? 200 : 503 }
  );
}
