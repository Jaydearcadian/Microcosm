"use client";

import React, { useState } from "react";
import { useSession } from "../identity/IdentityProvider.tsx";
import { useWallets } from "@privy-io/react-auth";

export function ReceivePanel() {
  const { principal, wallets: boundWallets } = useSession();
  const { wallets: privyWallets } = useWallets();
  const [copied, setCopied] = useState(false);

  const primaryAddress =
    boundWallets?.[0]?.address ||
    privyWallets?.[0]?.address ||
    null;

  const handleCopy = () => {
    if (!primaryAddress) return;
    navigator.clipboard.writeText(primaryAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const explorerUrl = primaryAddress
    ? `https://explorer.mainnet.arc.io/address/${primaryAddress}`
    : "#";

  return (
    <div className="card space-y-6">
      <div className="border-b border-border-subtle pb-4">
        <h2 className="text-xl font-semibold text-text-primary">Receive Arc USDC</h2>
        <p className="text-sm text-text-muted mt-1">
          Deposit USDC on Arc directly into your Microcosm Space.
        </p>
      </div>

      {!primaryAddress ? (
        <div className="p-6 bg-bg-surface rounded-xl border border-border-subtle text-center space-y-3">
          <p className="text-sm text-text-secondary">No Arc address linked to your Space yet.</p>
          <p className="text-xs text-text-muted">
            Visit Settings to link a verified external wallet or provision a session wallet.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Address Display Box */}
          <div className="p-4 bg-bg-surface rounded-xl border border-border-subtle space-y-3">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
              Your Arc Deposit Address
            </span>
            <div className="p-3 bg-bg-base rounded-lg border border-border-subtle break-all font-mono text-sm text-text-primary selection:bg-primary-accent selection:text-white">
              {primaryAddress}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="btn-primary flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Copy Address</span>
                  </>
                )}
              </button>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary px-3 py-2 text-xs font-medium flex items-center justify-center gap-1 text-text-secondary"
              >
                <span>Explorer</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>

          {/* Network Specifications */}
          <div className="space-y-2 text-xs bg-bg-elevated p-4 rounded-xl border border-border-subtle">
            <span className="font-semibold text-text-primary block mb-2">Network Parameters</span>
            <div className="flex justify-between py-1 border-b border-border-subtle">
              <span className="text-text-muted">Network</span>
              <span className="font-medium text-emerald-400">Arc Mainnet (5042) / Arc Testnet (5042002)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border-subtle">
              <span className="text-text-muted">Asset</span>
              <span className="font-medium text-text-primary">USDC (6 Decimals)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-text-muted">USDC Contract</span>
              <span className="font-mono text-text-secondary">0x3600000000000000000000000000000000000000</span>
            </div>
          </div>

          <div className="p-3 bg-blue-950/20 border border-blue-500/20 rounded-lg text-xs text-blue-300">
            <strong>Instant Settlement:</strong> Arc processes transactions sub-second. When USDC arrives at this address, your balance updates immediately.
          </div>
        </div>
      )}
    </div>
  );
}
