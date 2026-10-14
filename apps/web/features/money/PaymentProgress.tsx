"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createApiClient, ApiClientError } from "../../lib/api-client.ts";
import { useSession } from "../identity/IdentityProvider.tsx";

interface PaymentProgressProps {
  submission: {
    paymentId: string;
    txHash: string;
    chainId: number;
    amount: string;
    recipient: string;
  };
  onReset: () => void;
}

export function PaymentProgress({ submission, onReset }: PaymentProgressProps) {
  const { accessToken, activeSpace } = useSession();
  const [status, setStatus] = useState<"submitted" | "confirming" | "confirmed" | "failed">("submitted");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const explorerBase = submission.chainId === 5042
    ? "https://explorer.mainnet.arc.io/tx"
    : "https://explorer.testnet.arc.io/tx";
  const explorerUrl = `${explorerBase}/${submission.txHash}`;

  const checkConfirmation = async () => {
    if (!accessToken || !submission.paymentId) return;

    setStatus("confirming");
    setConfirmError(null);

    try {
      const api = createApiClient({
        getAccessToken: () => accessToken,
        getSpaceId: () => activeSpace?.id
      });

      const res = await api.confirmPayment(submission.paymentId);
      if (res.payment && res.payment.status === "confirmed") {
        setStatus("confirmed");
      } else {
        // Still pending receipt
        setStatus("submitted");
      }
    } catch (err: any) {
      console.warn("Confirmation check warning:", err);
      if (err instanceof ApiClientError && err.code === "confirmer_unavailable") {
        // Backend confirmer not configured for live RPC in this environment, but submission is safely recorded
        setConfirmError("Settlement submitted. Confirmer RPC is currently queued.");
      } else {
        setConfirmError(err.message || "Checking receipt...");
      }
      setStatus("submitted");
    }
  };

  useEffect(() => {
    // Attempt confirmation after 3 seconds
    const timer = setTimeout(() => {
      checkConfirmation();
    }, 3000);
    return () => clearTimeout(timer);
  }, [submission.paymentId, pollCount]);

  return (
    <div className="card space-y-6">
      <div className="text-center py-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 bg-bg-surface border border-border-subtle">
          {status === "confirmed" ? (
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-7 h-7 text-primary-accent animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
        </div>
        <h2 className="text-2xl font-bold text-text-primary">
          {status === "confirmed" ? "Payment Confirmed!" : "Payment Broadcasted"}
        </h2>
        <p className="text-sm text-text-muted mt-1">
          {status === "confirmed"
            ? `Successfully settled ${submission.amount} USDC on Arc.`
            : `Submitted ${submission.amount} USDC to Arc network.`}
        </p>
      </div>

      {/* State Transitions Tracker */}
      <div className="space-y-3 bg-bg-surface p-4 rounded-xl border border-border-subtle">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
            ✓
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">Intent Evaluated & Approved</p>
            <p className="text-xs text-text-muted">Verified by active Space envelope policies</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
            ✓
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">Client Signed & Submitted</p>
            <p className="text-xs text-text-muted">Transaction broadcasted by your wallet</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            status === "confirmed"
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-blue-500/20 text-blue-400 animate-pulse"
          }`}>
            {status === "confirmed" ? "✓" : "•"}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">Onchain Receipt Verification</p>
            <p className="text-xs text-text-muted">
              {status === "confirmed" ? "Receipt confirmed on Arc" : "Awaiting block settlement receipt"}
            </p>
          </div>
        </div>
      </div>

      {/* Transaction Details */}
      <div className="space-y-2 text-xs bg-bg-elevated p-3.5 rounded-lg border border-border-subtle">
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Transaction Hash</span>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-accent hover:underline font-mono"
          >
            {submission.txHash.slice(0, 10)}...{submission.txHash.slice(-8)} ↗
          </a>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Recipient</span>
          <span className="font-mono text-text-primary">{submission.recipient}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Chain ID</span>
          <span className="text-text-primary font-mono">{submission.chainId}</span>
        </div>
      </div>

      {confirmError && (
        <div className="text-xs text-text-muted text-center italic">
          {confirmError}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        {status !== "confirmed" && (
          <button
            type="button"
            onClick={() => {
              setPollCount((c) => c + 1);
              checkConfirmation();
            }}
            className="btn-secondary flex-1 py-2.5 text-xs font-medium"
          >
            Refresh Receipt Status
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="btn-secondary flex-1 py-2.5 text-xs font-medium"
        >
          New Payment
        </button>
        <Link
          href="/activity"
          className="btn-primary flex-1 py-2.5 text-xs font-semibold text-center flex items-center justify-center"
        >
          View Activity
        </Link>
      </div>
    </div>
  );
}
