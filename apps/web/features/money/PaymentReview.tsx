"use client";

import React, { useState } from "react";
import { parseUsdcBaseUnits } from "./money-validation.ts";
import { createApiClient, ApiClientError } from "../../lib/api-client.ts";
import { useSession } from "../identity/IdentityProvider.tsx";
import { useWallets } from "@privy-io/react-auth";
import type { SendFormData } from "./SendForm.tsx";

interface PaymentReviewProps {
  data: SendFormData;
  onBack: () => void;
  onSubmitted: (submission: {
    paymentId: string;
    txHash: string;
    chainId: number;
    amount: string;
    recipient: string;
  }) => void;
}

export function PaymentReview({ data, onBack, onSubmitted }: PaymentReviewProps) {
  const { accessToken, activeSpace, principal } = useSession();
  const { wallets } = useWallets();
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Populated after /v1/payments/prepare: shows whether the prepared calldata
  // targets the ProgrammableEnvelope (intent-bound, policy enforced onchain)
  // or the legacy direct USDC transfer path.
  const [prepRoute, setPrepRoute] = useState<{
    execution?: "direct" | "envelope";
    envelopeAddress?: string;
  } | null>(null);

  const parsedAmount = parseUsdcBaseUnits(data.amount);
  const baseUnitsString = parsedAmount.baseUnits?.toString() || "0";
  const userWallet = wallets?.[0];

  const handleAuthorizeAndSend = async () => {
    if (!accessToken) {
      setError("Active session required. Please sign in.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatusMessage("Creating and evaluating payment intent...");

    try {
      const api = createApiClient({
        getAccessToken: () => accessToken,
        getSpaceId: () => activeSpace?.id
      });

      // 1. Create unique idempotency key
      const idempotencyKey = `intent_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      // 2. Submit Intent to /v1/intents
      const intentRes = await api.createIntent(
        {
          target: data.recipient,
          amount: data.amount,
          asset: "USDC",
          memo: data.memo,
          spaceId: activeSpace?.id
        },
        idempotencyKey
      );

      const intent = intentRes.intent;
      if (!intent || !intent.id) {
        throw new Error("Failed to create intent: Invalid server response");
      }

      // Check evaluation
      if (intentRes.evaluation && !intentRes.evaluation.approved) {
        const reason = intentRes.evaluation.violations?.join(", ") || "Policy violation";
        throw new Error(`Intent rejected by Space envelope: ${reason}`);
      }

      setStatusMessage("Preparing calldata for user authorization...");

      // 3. Prepare Payment calldata
      const prepRes = await api.preparePayment(intent.id);
      if (!prepRes.to || !prepRes.calldata) {
        throw new Error("Server did not return transaction calldata");
      }

      const { to, calldata, value, chainId } = prepRes;
      setPrepRoute({
        execution: prepRes.execution,
        envelopeAddress: prepRes.envelopeAddress
      });
      const targetChainId = Number(chainId || 5042);

      setStatusMessage("Awaiting user wallet signature...");

      // 4. Client-side signature via user's connected wallet
      let txHash: string;
      if (userWallet) {
        const ethereumProvider = await userWallet.getEthereumProvider();
        txHash = (await ethereumProvider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: userWallet.address,
              to,
              data: calldata,
              value: value || "0x0",
              chainId: `0x${targetChainId.toString(16)}`
            }
          ]
        })) as string;
      } else if (typeof window !== "undefined" && (window as any).ethereum) {
        const ethereum = (window as any).ethereum;
        const accounts = await ethereum.request({ method: "eth_requestAccounts" });
        txHash = (await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: accounts[0],
              to,
              data: calldata,
              value: value || "0x0",
              chainId: `0x${targetChainId.toString(16)}`
            }
          ]
        })) as string;
      } else {
        throw new Error("No web3 wallet found. Please connect or link a wallet.");
      }

      if (!txHash || typeof txHash !== "string" || !txHash.startsWith("0x")) {
        throw new Error("Transaction signature failed or was cancelled by user.");
      }

      setStatusMessage("Broadcasting & recording submission...");

      // 5. Submit transaction record to API
      const subRes = await api.submitPayment(
        {
          intentId: intent.id,
          txHash,
          chainId: targetChainId,
          senderAddress: userWallet?.address
        },
        `sub_${txHash}`
      );

      const resolvedPaymentId = subRes.submission?.paymentId || intent.id;

      setStatusMessage("Payment submitted successfully!");
      onSubmitted({
        paymentId: resolvedPaymentId,
        txHash,
        chainId: targetChainId,
        amount: data.amount,
        recipient: data.recipient
      });
    } catch (err: any) {
      console.error("Payment execution error:", err);
      let msg = err.message || "Payment execution failed";
      if (err instanceof ApiClientError) {
        msg = `[${err.code}] ${err.message}`;
      } else if (err.code === 4001 || err.message?.includes("User rejected")) {
        msg = "Transaction was declined in your wallet.";
      }
      setError(msg);
      setStatusMessage(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card space-y-6">
      <div className="border-b border-border-subtle pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Review Transfer</h2>
          <p className="text-sm text-text-muted mt-1">
            Client-authorized direct transfer on Arc.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          Edit
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {statusMessage && (
        <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-lg text-sm text-blue-300 animate-pulse">
          {statusMessage}
        </div>
      )}

      {/* Review Summary Breakdown */}
      <div className="space-y-3 bg-bg-surface p-4 rounded-xl border border-border-subtle text-sm">
        <div className="flex justify-between items-center py-1 border-b border-border-subtle">
          <span className="text-text-muted">Asset</span>
          <span className="font-medium text-text-primary">Arc USDC (6 decimals)</span>
        </div>
        <div className="flex justify-between items-center py-1 border-b border-border-subtle">
          <span className="text-text-muted">Contract</span>
          {prepRoute?.execution === "envelope" && prepRoute.envelopeAddress ? (
            <span className="font-mono text-xs text-emerald-400 truncate max-w-[220px]">
              {prepRoute.envelopeAddress.slice(0, 10)}…{prepRoute.envelopeAddress.slice(-6)}
            </span>
          ) : (
            <span className="font-mono text-xs text-text-secondary">0x3600000000000000000000000000000000000000</span>
          )}
        </div>
        <div className="flex justify-between items-center py-1 border-b border-border-subtle">
          <span className="text-text-muted">Route</span>
          <span
            className={`text-xs font-medium ${
              prepRoute?.execution === "envelope" ? "text-emerald-400" : "text-text-secondary"
            }`}
          >
            {prepRoute?.execution === "envelope"
              ? "Programmable Envelope (onchain policy)"
              : "Direct USDC transfer"}
          </span>
        </div>
        <div className="flex justify-between items-center py-1 border-b border-border-subtle">
          <span className="text-text-muted">Recipient</span>
          <span className="font-mono text-xs text-text-primary truncate max-w-[220px]">
            {data.recipient}
          </span>
        </div>
        <div className="flex justify-between items-center py-1 border-b border-border-subtle">
          <span className="text-text-muted">Network</span>
          <span className="font-medium text-emerald-400">Arc (Chain ID 5042)</span>
        </div>
        <div className="flex justify-between items-center py-1 border-b border-border-subtle">
          <span className="text-text-muted">Amount</span>
          <span className="font-mono font-semibold text-lg text-text-primary">
            {data.amount} USDC
          </span>
        </div>
        <div className="flex justify-between items-center py-1">
          <span className="text-text-muted">Base Units (BigInt)</span>
          <span className="font-mono text-xs text-text-muted">{baseUnitsString}</span>
        </div>
        {data.memo && (
          <div className="flex justify-between items-center pt-1 border-t border-border-subtle">
            <span className="text-text-muted">Note</span>
            <span className="text-text-secondary text-xs italic">{data.memo}</span>
          </div>
        )}
      </div>

      <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-lg text-xs text-amber-300/80">
        <strong>Zero Server Custody:</strong> Microcosm never holds your private keys. You will sign the exact transaction directly in your wallet.
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="btn-secondary flex-1 py-3 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleAuthorizeAndSend}
          disabled={submitting}
          className="btn-primary flex-1 py-3 text-sm font-semibold flex justify-center items-center gap-2"
        >
          {submitting ? "Signing & Sending..." : "Authorize & Send"}
        </button>
      </div>
    </div>
  );
}
