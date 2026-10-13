/**
 * Send USDC to another wallet on Arc Testnet
 * 
 * Prerequisites:
 * 1. Fund your wallet with testnet USDC from https://faucet.circle.com
 */

import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import type { SendParams } from "@circle-fin/app-kit";
import { inspect } from "util";

const kit = new AppKit();

const sendTokens = async (): Promise<void> => {
  try {
    const adapter = createViemAdapterFromPrivateKey({
      privateKey: process.env.PRIVATE_KEY as string,
    });

    // Replace with your recipient address
    const recipientAddress = "0x1234567890123456789012345678901234567890";

    console.log("---------------Starting Send---------------");
    console.log("Chain: Arc Testnet");
    console.log("Token: USDC");
    console.log("Amount: 1.00");
    console.log(`To: ${recipientAddress}\n`);

    const sendParams: SendParams = {
      from: { adapter, chain: "Arc_Testnet" },
      to: recipientAddress,
      amount: "1.00",
      token: "USDC",
    };

    // Estimate gas first
    console.log("Estimating gas...");
    const estimate = await kit.estimateSend(sendParams);
    console.log(`Estimated gas: ${inspect(estimate)}\n`);

    // Execute the send
    const result = await kit.send(sendParams);
    console.log("RESULT:", inspect(result, false, null, true));
    
    if (result.explorerUrl) {
      console.log(`\nExplorer: ${result.explorerUrl}`);
    }
  } catch (err) {
    console.log("ERROR:", inspect(err, false, null, true));
  }
};

void sendTokens();
