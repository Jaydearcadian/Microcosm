/**
 * Swap USDC for EURC on Arc Testnet
 * 
 * Prerequisites:
 * 1. Fund your wallet with testnet USDC from https://faucet.circle.com
 * 2. Get a free kit key from https://console.circle.com -> Keys -> Kit Keys
 */

import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { inspect } from "util";

const kit = new AppKit();

const swapUSDCToEURC = async (): Promise<void> => {
  try {
    const adapter = createViemAdapterFromPrivateKey({
      privateKey: process.env.PRIVATE_KEY as string,
    });

    console.log("---------------Starting Swap---------------");
    console.log("Chain: Arc Testnet");
    console.log("Token In: USDC");
    console.log("Token Out: EURC");
    console.log("Amount: 1.00 USDC\n");

    const result = await kit.swap({
      from: { adapter, chain: "Arc_Testnet" },
      tokenIn: "USDC",
      tokenOut: "EURC",
      amountIn: "1.00",
      config: {
        kitKey: process.env.KIT_KEY as string,
      },
    });

    console.log("RESULT:", inspect(result, false, null, true));
    
    if (result.explorerUrl) {
      console.log(`\nExplorer: ${result.explorerUrl}`);
    }
    console.log(`\nAmount Out: ${result.amountOut} EURC`);
  } catch (err) {
    console.log("ERROR:", inspect(err, false, null, true));
  }
};

void swapUSDCToEURC();
