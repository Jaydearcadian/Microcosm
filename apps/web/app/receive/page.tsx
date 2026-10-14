"use client";

import React from "react";
import { AppShell } from "../../components/AppShell.tsx";
import { PageHeader } from "../../components/PageHeader.tsx";
import { useSession } from "../../features/identity/IdentityProvider.tsx";
import { ReceivePanel } from "../../features/receive/ReceivePanel.tsx";

export default function ReceivePage() {
  const { authenticated, login } = useSession();

  return (
    <AppShell activeRoute="/receive">
      <div className="max-w-xl mx-auto space-y-6">
        <PageHeader
          title="Receive Funds"
          subtitle="Deposit Arc USDC into your Space from any external wallet or exchange."
        />

        {!authenticated ? (
          <div className="card text-center py-12 space-y-4">
            <h3 className="text-lg font-semibold text-text-primary">Sign in to View Deposit Address</h3>
            <p className="text-sm text-text-muted max-w-sm mx-auto">
              Your deposit address is derived from your verified Microcosm Space credentials.
            </p>
            <button onClick={login} className="btn-primary px-6 py-2.5 text-sm font-semibold">
              Sign In
            </button>
          </div>
        ) : (
          <ReceivePanel />
        )}
      </div>
    </AppShell>
  );
}
