"use client";

import React, { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useSession } from "./IdentityProvider.tsx";
import { createApiClient, ApiClientError } from "../../lib/api-client.ts";

export const RecoveryPanel: React.FC = () => {
  const { user, activeSpace, wallets, identities, privyUser, refreshSession } = useSession();
  const { wallets: connectedWallets } = useWallets();

  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);

  const handleLinkWallet = async () => {
    if (!connectedWallets || connectedWallets.length === 0) {
      setLinkError("No external wallet connected. Please connect a wallet via Privy first.");
      return;
    }

    const activeWallet = connectedWallets[0]!;
    setLinking(true);
    setLinkError(null);
    setLinkSuccess(null);

    try {
      const client = createApiClient();
      // 1. Request single-use challenge from server
      const { challenge } = await client.requestWalletChallenge(activeWallet.address);

      // 2. Request EIP-191 personal_sign signature from connected wallet
      const provider = await activeWallet.getEthereumProvider();
      const signature = (await provider.request({
        method: "personal_sign",
        params: [challenge.message, activeWallet.address]
      })) as string;

      // 3. Submit cryptographic proof to server
      await client.linkWallet(challenge.id, signature);

      setLinkSuccess(`Wallet ${activeWallet.address.slice(0, 6)}...${activeWallet.address.slice(-4)} linked and signature-verified!`);
      await refreshSession();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setLinkError(err.message);
      } else {
        setLinkError(err instanceof Error ? err.message : "Failed to link wallet");
      }
    } finally {
      setLinking(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Microcosm Canonical Identity */}
      <div className="card">
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Microcosm Identity
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginBottom: "1rem" }}>
          Your Microcosm principal is stable, sovereign, and decoupled from any individual login method or wallet.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.875rem" }}>
          <div>
            <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", display: "block" }}>
              Canonical Principal ID
            </span>
            <code style={{ fontFamily: "var(--font-mono)", color: "var(--primary)", fontSize: "0.8125rem" }}>
              {user?.id || "Loading..."}
            </code>
          </div>

          <div>
            <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", display: "block" }}>
              Personal Space ID
            </span>
            <code style={{ fontFamily: "var(--font-mono)", color: "var(--text)", fontSize: "0.8125rem" }}>
              {activeSpace?.id || "Loading..."}
            </code>
          </div>

          <div>
            <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", display: "block" }}>
              Principal Status
            </span>
            <span className="badge badge-success" style={{ marginTop: "2px" }}>
              {user?.status || "active"}
            </span>
          </div>
        </div>
      </div>

      {/* Login Authentication Recovery */}
      <div className="card">
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Login Methods & Authentication Recovery
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginBottom: "1rem" }}>
          Recovering your login allows you to sign back into your Microcosm space. It does <strong>not</strong> grant custodian access to external self-custody private keys.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {identities.length > 0 ? (
            identities.map((id, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0.75rem",
                  background: "var(--bg)",
                  border: "1px solid var(--surface-border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.875rem"
                }}
              >
                <div>
                  <span style={{ fontWeight: 500, textTransform: "capitalize" }}>
                    {id.identityType}
                  </span>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {id.providerSubject}
                  </div>
                </div>
                <span className="badge badge-success">Verified</span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              {privyUser?.email?.address ? `Email: ${privyUser.email.address}` : "Standard session active"}
            </div>
          )}
        </div>
      </div>

      {/* Linked Wallets & Cryptographic Verification */}
      <div className="card">
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Linked Wallets & Key Control
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginBottom: "1rem" }}>
          To authorize transfers on Arc, you retain exclusive control of your signing keys. Linking requires an onchain EIP-191 signature.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
          {wallets.length > 0 ? (
            wallets.map((w) => (
              <div
                key={w.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.625rem 0.75rem",
                  background: "var(--bg)",
                  border: "1px solid var(--surface-border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.875rem"
                }}
              >
                <div>
                  <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--text)" }}>
                    {w.address}
                  </code>
                  <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", marginTop: "2px" }}>
                    Role: {w.role} | Verification: {w.verification}
                  </div>
                </div>
                <span className="badge badge-success">{w.status}</span>
              </div>
            ))
          ) : (
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              No signature-verified wallets linked to this Space yet.
            </p>
          )}
        </div>

        {connectedWallets && connectedWallets.length > 0 && (
          <div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLinkWallet}
              disabled={linking}
              style={{ width: "100%" }}
            >
              {linking ? "Signing Challenge in Wallet..." : `Verify & Link ${connectedWallets[0]!.address.slice(0, 6)}...${connectedWallets[0]!.address.slice(-4)}`}
            </button>
          </div>
        )}

        {linkSuccess && (
          <div style={{ marginTop: "0.75rem", color: "var(--success)", fontSize: "0.8125rem" }}>
            {linkSuccess}
          </div>
        )}

        {linkError && (
          <div style={{ marginTop: "0.75rem", color: "var(--danger)", fontSize: "0.8125rem" }}>
            {linkError}
          </div>
        )}
      </div>
    </div>
  );
};
