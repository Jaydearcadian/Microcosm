"use client";

import React from "react";
import { AppShell } from "../../components/AppShell.tsx";
import { PageHeader } from "../../components/PageHeader.tsx";
import { useSession } from "../../features/identity/IdentityProvider.tsx";
import { RecoveryPanel } from "../../features/identity/RecoveryPanel.tsx";

export default function SettingsPage() {
  const { authenticated, principal, activeSpace, identities, privyUser, login, logout } = useSession();

  const displayEmail =
    identities?.find((i) => i.identityType === "email")?.providerSubject ||
    privyUser?.email?.address ||
    "Unlinked";

  return (
    <AppShell activeRoute="/settings">
      <div className="max-w-xl mx-auto space-y-6">
        <PageHeader
          title="Settings & Identity"
          subtitle="Manage your canonical principal, verified wallet bindings, and network config."
        />

        {!authenticated ? (
          <div className="card text-center py-12 space-y-4">
            <h3 className="text-lg font-semibold text-text-primary">Sign in to Access Settings</h3>
            <p className="text-sm text-text-muted max-w-sm mx-auto">
              Configure your Microcosm identity, link external wallets, and manage Spaces.
            </p>
            <button onClick={login} className="btn-primary px-6 py-2.5 text-sm font-semibold">
              Sign In
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Identity & Space Details */}
            <div className="card space-y-4">
              <div className="border-b border-border-subtle pb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-semibold text-text-primary">Canonical Identity</h3>
                  <p className="text-xs text-text-muted">
                    Stable internal Microcosm principal independent of login provider.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="btn-secondary text-xs px-3 py-1.5 text-red-400 hover:text-red-300"
                >
                  Sign Out
                </button>
              </div>

              <div className="space-y-2 text-xs bg-bg-surface p-3.5 rounded-lg border border-border-subtle">
                <div className="flex justify-between items-center py-1 border-b border-border-subtle">
                  <span className="text-text-muted">Principal ID</span>
                  <span className="font-mono text-text-primary">{principal?.id}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border-subtle">
                  <span className="text-text-muted">Email / Handle</span>
                  <span className="text-text-secondary">{displayEmail}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border-subtle">
                  <span className="text-text-muted">Active Space ID</span>
                  <span className="font-mono text-text-primary">{activeSpace?.id}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-text-muted">Space Type</span>
                  <span className="badge-surface text-[10px] font-mono uppercase text-emerald-400">
                    {activeSpace?.type || "personal"}
                  </span>
                </div>
              </div>
            </div>

            {/* Wallet Linking & Recovery */}
            <RecoveryPanel />

            {/* Arc Network Info */}
            <div className="card space-y-4">
              <div className="border-b border-border-subtle pb-3">
                <h3 className="text-base font-semibold text-text-primary">Arc Network Parameters</h3>
                <p className="text-xs text-text-muted">
                  Settlement parameters enforced across all consumer flows.
                </p>
              </div>

              <div className="space-y-2 text-xs bg-bg-surface p-3.5 rounded-lg border border-border-subtle">
                <div className="flex justify-between items-center py-1 border-b border-border-subtle">
                  <span className="text-text-muted">Chain ID</span>
                  <span className="font-mono text-text-primary">5042 (Mainnet) / 5042002 (Testnet)</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border-subtle">
                  <span className="text-text-muted">Settlement Token</span>
                  <span className="font-medium text-text-primary">USDC (6 decimals)</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border-subtle">
                  <span className="text-text-muted">Official USDC Address</span>
                  <span className="font-mono text-text-secondary break-all">
                    0x3600000000000000000000000000000000000000
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-text-muted">Custody Model</span>
                  <span className="font-medium text-emerald-400">Non-custodial, client intent-bound</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
