"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "../identity/IdentityProvider.tsx";
import { createApiClient, ApiClientError } from "../../lib/api-client.ts";

export const WalletSummary: React.FC = () => {
  const { authenticated, wallets, activeSpace } = useSession();
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryWallet = wallets.find((w) => w.role === "primary") || wallets[0];

  const fetchBalance = useCallback(async () => {
    if (!authenticated || !activeSpace) return;
    setLoading(true);
    setError(null);

    try {
      const client = createApiClient({ getSpaceId: () => activeSpace.id });
      const res = await client.getBalance("USDC");
      setBalance(res.amountDecimal);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        // Fallback default for un-funded demo address
        setBalance("0.000000");
      }
    } finally {
      setLoading(false);
    }
  }, [authenticated, activeSpace]);

  useEffect(() => {
    void fetchBalance();
  }, [fetchBalance]);

  const formattedBalance = (() => {
    if (!balance) return "0.00";
    const [whole = "0", fraction = "00"] = balance.split(".");
    try {
      const formattedWhole = BigInt(whole).toLocaleString("en-US");
      return fraction ? `${formattedWhole}.${fraction.slice(0, 6)}` : `${formattedWhole}.00`;
    } catch {
      return balance;
    }
  })();

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Available Arc USDC
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
            <span style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
              {loading ? "..." : formattedBalance}
            </span>
            <span style={{ fontSize: "1rem", color: "var(--primary)", fontWeight: 600 }}>
              USDC
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void fetchBalance()}
          disabled={loading}
          style={{
            background: "transparent",
            border: "1px solid var(--surface-border)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 8px",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            cursor: "pointer"
          }}
          aria-label="Refresh balance"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {primaryWallet ? (
        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          <span>Linked Wallet: </span>
          <code style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>
            {primaryWallet.address.slice(0, 8)}...{primaryWallet.address.slice(-6)}
          </code>
        </div>
      ) : (
        <div style={{ fontSize: "0.8125rem", color: "var(--text-dim)" }}>
          No linked wallet detected. Go to Settings to link a wallet.
        </div>
      )}

      {error && (
        <div style={{ color: "var(--danger)", fontSize: "0.8125rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.5rem" }}>
        <Link href="/money" className="btn btn-primary" style={{ textAlign: "center" }}>
          Send USDC
        </Link>
        <Link href="/receive" className="btn btn-secondary" style={{ textAlign: "center" }}>
          Receive
        </Link>
      </div>
    </div>
  );
};
