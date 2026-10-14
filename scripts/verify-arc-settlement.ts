import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { verifyUsdcTransfer, ARC_USDC_ADDRESS } from "@mcosm/adapter-arc";
import fs from "node:fs";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] }
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" }
  }
});

const erc20Abi = [
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

async function main() {
  console.log("=== Arc Onchain Settlement Verification ===");
  const privateKey = (process.env.TESTNET_PRIVATE_KEY ||
    "0x57636c2a004f54128642afb1dfb45c5c02012e679a8f19eaa80569ddbb643b66") as `0x${string}`;

  const account = privateKeyToAccount(privateKey);
  console.log("Using sender wallet:", account.address);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http("https://rpc.testnet.arc.network")
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http("https://rpc.testnet.arc.network")
  });

  const chainId = await publicClient.getChainId();
  console.log("Connected to Arc chain ID:", chainId);
  if (chainId !== 5042002) {
    throw new Error(`Unexpected chain ID ${chainId}, expected 5042002`);
  }

  // Exact 1 base unit (0.000001 USDC)
  const transferAmountBaseUnits = 1n;
  const recipient = account.address; // Self-transfer preserves balance

  console.log("Sending verified transfer of 1 base unit USDC...");
  const txHash = await walletClient.writeContract({
    address: ARC_USDC_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient, transferAmountBaseUnits]
  });

  console.log("Transaction broadcast! Hash:", txHash);
  console.log("Explorer link:", `https://testnet.arcscan.app/tx/${txHash}`);
  console.log("Waiting for block inclusion and receipt...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("Transaction mined in block:", receipt.blockNumber.toString());
  console.log("Receipt status:", receipt.status);

  console.log("Running Microcosm verifyUsdcTransfer verification...");
  const verification = await verifyUsdcTransfer(publicClient, {
    txHash,
    expectedChainId: 5042002,
    tokenAddress: ARC_USDC_ADDRESS,
    from: account.address,
    to: recipient,
    amountBaseUnits: transferAmountBaseUnits
  });

  console.log("Verification Result:", JSON.stringify(verification, null, 2));

  if (verification.status !== "confirmed") {
    throw new Error(`Verification failed with status ${verification.status}: ${verification.reason}`);
  }

  const evidence = `# Arc Onchain Settlement Verification Evidence

**Generated:** ${new Date().toISOString()}  
**Network:** Arc Testnet (Chain ID 5042002)  
**RPC URL:** https://rpc.testnet.arc.network  
**USDC Contract:** \`${ARC_USDC_ADDRESS}\`  
**Sender:** \`${account.address}\`  
**Recipient:** \`${recipient}\`  
**Amount Base Units:** \`${transferAmountBaseUnits.toString()}\` (0.000001 USDC)  
**Transaction Hash:** \`${txHash}\`  
**Block Number:** \`${receipt.blockNumber.toString()}\`  
**Block Hash:** \`${receipt.blockHash}\`  
**Receipt Status:** \`${receipt.status}\`  
**Verification Result:** \`${verification.status}\`  
**Explorer URL:** https://testnet.arcscan.app/tx/${txHash}  

## Observed Transfer Log
\`\`\`json
${JSON.stringify(verification.observedTransfer, null, 2)}
\`\`\`

## Verification Proof
Verified using \`@mcosm/adapter-arc\` fail-closed receipt parser:
- ERC-20 \`Transfer\` event topic \`0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef\`
- Target contract address strictly equals official USDC \`${ARC_USDC_ADDRESS}\`
- Sender address matches \`${account.address.toLowerCase()}\`
- Recipient address matches \`${recipient.toLowerCase()}\`
- Exact base unit integer value matches \`${transferAmountBaseUnits.toString()}\`
`;

  fs.writeFileSync("docs/superpowers/plans/evidence/arc-settlement.md", evidence);
  console.log("Evidence written to docs/superpowers/plans/evidence/arc-settlement.md");
}

main().catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});
