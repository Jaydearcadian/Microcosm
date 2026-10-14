"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "../identity/IdentityProvider.tsx";
import { PageHeader } from "../../components/PageHeader.tsx";
import { NetworkStatus } from "../wallet/NetworkStatus.tsx";
import { WalletSummary } from "../wallet/WalletSummary.tsx";

export const HomeOverview: React.FC = () => {
  const { ready, authenticated, user, activeSpace, login, logout } = useSession();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title={authenticated ? (activeSpace?.name || "Personal Space") : "Microcosm"}
        subtitle={
          authenticated
            ? `Principal ID: ${user?.id || "resolving..."}`
            : "Arc-native programmable financial home"
        }
        action={
          ready && (
            authenticated ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void logout()}
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => login()}
              >
                Sign in with Privy
              </button>
            )
          )
        }
      />

      <NetworkStatus chainId={5042} networkName="Arc Mainnet" isOnline={true} />

      {authenticated ? (
        <>
          <WalletSummary />

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Recent Activity</h3>
              <Link href="/activity" style={{ fontSize: "0.8125rem", color: "var(--primary)" }}>
                View all →
              </Link>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              Real-time payment settlements, intent approvals, and wallet verifications.
            </p>
          </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Welcome to Microcosm
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", maxWidth: "420px", margin: "0 auto 1.5rem auto" }}>
            Connect your wallet or email to enter your personal financial space. Execute client-signed USDC transfers on Arc with independent receipt confirmation.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => login()}
            style={{ minWidth: "160px" }}
          >
            Get Started
          </button>
        </div>
      )}
    </div>
  );
};
