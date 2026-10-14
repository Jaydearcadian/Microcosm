import { NextResponse } from "next/server.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const isMainnet = process.env.ARC_NETWORK !== "testnet";
  const chainId = isMainnet ? 5042 : 5042002;
  const defaultRpc = isMainnet ? "https://rpc.mainnet.arc.io/" : "https://rpc.testnet.arc.network";
  const rpcUrl = isMainnet
    ? (process.env.ARC_MAINNET_RPC_URL || defaultRpc)
    : (process.env.ARC_TESTNET_RPC_URL || defaultRpc);

  const proxyConfigured = Boolean(
    process.env.MICROCOSM_API_PROXY && process.env.MICROCOSM_API_PROXY.trim().length > 0
  );

  return NextResponse.json({
    status: "ok",
    service: "microcosm-web-gateway",
    network: isMainnet ? "mainnet" : "testnet",
    chainId,
    rpcUrl,
    usdcAddress: "0x3600000000000000000000000000000000000000",
    privyAppIdConfigured: Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID),
    apiProxyConfigured: proxyConfigured,
    timestamp: new Date().toISOString()
  });
}
