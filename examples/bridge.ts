/**
 * Bridge USDC from Ethereum Sepolia to Arc Testnet
 * 
 * Prerequisites:
 * 1. Fund your wallet with testnet USDC from https://faucet.circle.com
 * 2. Get native tokens for Ethereum Sepolia from https://www.alchemy.com/faucets/ethereum-sepolia
 */

import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { inspect } from "util";

const kit = new AppKit();

const bridgeUSDC = async (): Promise<void> => {
  try {
    const adapter = createViemAdapterFromPrivateKey({
      privateKey: process.env.PRIVATE_KEY as string,
    });

    console.log("---------------Starting Bridge---------------");
    console.log("From: Ethereum Sepolia");
    console.log("To: Arc Testnet");
    console.log("Amount: 1.00 USDC\n");

    const result = await kit.bridge({
      from: { adapter, chain: "Ethereum_Sepolia" },
      to: { adapter, chain: "Arc_Testnet" },
      amount: "1.00",
    });

    console.log("RESULT:", inspect(result, false, null, true));
    
    if (result.steps) {
      console.log("\n--- Transaction Steps ---");
      result.steps.forEach((step, i) => {
        console.log(`${i + 1}. ${step.name}: ${step.state}`);
        if (step.explorerUrl) {
          console.log(`   Explorer: ${step.explorerUrl}`);
        }
      });
    }
  } catch (err) {
    console.log("ERROR:", inspect(err, false, null, true));
  }
};

void bridgeUSDC();
