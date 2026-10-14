"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "../../components/AppShell.tsx";
import { PageHeader } from "../../components/PageHeader.tsx";
import { useSession } from "../../features/identity/IdentityProvider.tsx";
import { ActivityList } from "../../features/activity/ActivityList.tsx";
import { PaymentReceipt } from "../../features/activity/PaymentReceipt.tsx";
import { createApiClient } from "../../lib/api-client.ts";
import type { ActivityItem } from "@mcosm/api-contracts";

export default function ActivityPage() {
  const { authenticated, accessToken, activeSpace, login } = useSession();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  const loadActivity = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const api = createApiClient({
        getAccessToken: () => accessToken,
        getSpaceId: () => activeSpace?.id
      });
      const data = await api.listActivity();
      if (data && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch (err) {
      console.warn("Failed to load activity:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated && accessToken) {
      loadActivity();
    }
  }, [authenticated, accessToken, activeSpace?.id]);

  return (
    <AppShell activeRoute="/activity">
      <div className="max-w-xl mx-auto space-y-6">
        <PageHeader
          title="Activity & Settlements"
          subtitle="Real-time audit log of payment submissions, confirmations, and Space events."
        />

        {!authenticated ? (
          <div className="card text-center py-12 space-y-4">
            <h3 className="text-lg font-semibold text-text-primary">Sign in to View Activity</h3>
            <p className="text-sm text-text-muted max-w-sm mx-auto">
              Each Microcosm Space maintains an isolated, cryptographically auditable log of settlements.
            </p>
            <button onClick={login} className="btn-primary px-6 py-2.5 text-sm font-semibold">
              Sign In
            </button>
          </div>
        ) : selectedPaymentId ? (
          <PaymentReceipt
            paymentId={selectedPaymentId}
            onClose={() => setSelectedPaymentId(null)}
          />
        ) : (
          <ActivityList
            items={items}
            loading={loading}
            onRefresh={loadActivity}
            onSelectPayment={(id) => setSelectedPaymentId(id)}
          />
        )}
      </div>
    </AppShell>
  );
}
