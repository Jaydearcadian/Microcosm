"use client";

import React, { useState, useEffect } from "react";
import { createApiClient, ApiClientError } from "../../lib/api-client.ts";
import { useSession } from "../identity/IdentityProvider.tsx";
import type { Payment } from "@mcosm/api-contracts";

interface PaymentReceiptProps {
  paymentId?: string;
  initialPayment?: Payment | null;
  onClose?: () => void;
}

export function PaymentReceipt({ paymentId, initialPayment, onClose }: PaymentReceiptProps) {
  const { accessToken, activeSpace } = useSession();
  const [payment, setPayment] = useState<Payment | null>(initialPayment || null);
  const [loading, setLoading] = useState(!initialPayment && !!paymentId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPayment) {
      setPayment(initialPayment);
      return;
    }

    if (!paymentId || !accessToken) return;

    let mounted = true;
    const fetchPayment = async () => {
      setLoading(true);
      setError(null);
      try {
        const api = createApiClient({
          getAccessToken: () => accessToken,
          getSpaceId: () => activeSpace?.id
        });
        const res = await api.getPayment(paymentId);
        if (mounted) {
          setPayment(res.payment || res);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || "Failed to load payment receipt.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPayment();
    return () => {
      mounted = false;
    };
  }, [paymentId, initialPayment, accessToken, activeSpace?.id]);

  if (loading) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-text-muted animate-pulse">Loading payment receipt...</p>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="card space-y-4">
        <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error || "Payment record not found."}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="btn-secondary w-full py-2 text-xs">
            Back to Activity
          </button>
        )}
      </div>
    );
  }

  const isConfirmed = payment.status === "CONFIRMED";
  const isFailed = payment.status === "FAILED" || payment.status === "REJECTED";
  const chainId = payment.chainId || 5042;
  const explorerBase = chainId === 5042
    ? "https://explorer.mainnet.arc.io/tx"
    : "https://explorer.testnet.arc.io/tx";
  const explorerUrl = payment.txHash ? `${explorerBase}/${payment.txHash}` : null;

  return (
    <div className="card space-y-6">
      <div className="flex justify-between items-start border-b border-border-subtle pb-4">
        <div>
          <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-text-muted block">
            Verifiable Settlement Receipt
          </span>
          <h2 className="text-xl font-bold text-text-primary mt-1">
            {payment.amountDecimal} USDC
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge-surface text-xs font-mono font-semibold px-2.5 py-1 ${
            isConfirmed
              ? "text-emerald-400 border-emerald-500/30 bg-emerald-950/20"
              : isFailed
              ? "text-red-400 border-red-500/30 bg-red-950/20"
              : "text-blue-400 border-blue-500/30 bg-blue-950/20"
          }`}>
            {payment.status}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-surface transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Audit Fields */}
      <div className="space-y-3 bg-bg-surface p-4 rounded-xl border border-border-subtle text-xs">
        <div className="flex justify-between items-center py-1 border-b border-border-subtle">
          <span className="text-text-muted">Payment ID</span>
          <span className="font-mono text-text-secondary">{payment.id}</span>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-border-subtle">
          <span className="text-text-muted">Intent ID</span>
          <span className="font-mono text-text-secondary">{payment.intentId}</span>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-border-subtle">
          <span className="text-text-muted">Recipient Address</span>
          <span className="font-mono text-text-primary truncate max-w-[200px] sm:max-w-xs">
            {payment.recipientAddress}
          </span>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-border-subtle">
          <span className="text-text-muted">Sender Address</span>
          <span className="font-mono text-text-secondary truncate max-w-[200px] sm:max-w-xs">
            {payment.senderAddress || "Client authorized"}
          </span>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-border-subtle">
          <span className="text-text-muted">Network</span>
          <span className="font-medium text-text-primary">Arc (Chain ID: {chainId})</span>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-border-subtle">
          <span className="text-text-muted">Token Contract</span>
          <span className="font-mono text-text-secondary">
            {payment.tokenAddress || "0x3600000000000000000000000000000000000000"}
          </span>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-border-subtle">
          <span className="text-text-muted">Base Units (BigInt)</span>
          <span className="font-mono text-text-primary">{payment.amountBaseUnits}</span>
        </div>

        {payment.txHash && (
          <div className="flex justify-between items-center py-1 border-b border-border-subtle">
            <span className="text-text-muted">Transaction Hash</span>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary-accent hover:underline flex items-center gap-1"
              >
                <span>{payment.txHash.slice(0, 8)}...{payment.txHash.slice(-6)}</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <span className="font-mono text-text-secondary">{payment.txHash}</span>
            )}
          </div>
        )}

        <div className="flex justify-between items-center py-1 border-b border-border-subtle">
          <span className="text-text-muted">Created</span>
          <span className="text-text-secondary">
            {new Date(payment.createdAt).toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between items-center py-1">
          <span className="text-text-muted">Last Updated</span>
          <span className="text-text-secondary">
            {new Date(payment.updatedAt).toLocaleString()}
          </span>
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary w-full py-2.5 text-xs font-semibold"
        >
          Close Receipt
        </button>
      )}
    </div>
  );
}
