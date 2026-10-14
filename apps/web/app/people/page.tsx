"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "../../components/AppShell.tsx";
import { PageHeader } from "../../components/PageHeader.tsx";
import { useSession } from "../../features/identity/IdentityProvider.tsx";
import { PeopleList } from "../../features/people/PeopleList.tsx";
import { RecipientForm } from "../../features/people/RecipientForm.tsx";
import { createApiClient } from "../../lib/api-client.ts";
import type { Recipient } from "@mcosm/api-contracts";

export default function PeoplePage() {
  const { authenticated, accessToken, activeSpace, login } = useSession();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const loadRecipients = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const api = createApiClient({
        getAccessToken: () => accessToken,
        getSpaceId: () => activeSpace?.id
      });
      const data = await api.listRecipients();
      if (Array.isArray(data)) {
        setRecipients(data);
      }
    } catch (err) {
      console.warn("Failed to load recipients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated && accessToken) {
      loadRecipients();
    }
  }, [authenticated, accessToken, activeSpace?.id]);

  return (
    <AppShell activeRoute="/people">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <PageHeader
            title="People & Contacts"
            subtitle="Manage authorized contacts and payout destinations in your Space."
          />
          {authenticated && !showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 shrink-0"
            >
              <span>+ Add Contact</span>
            </button>
          )}
        </div>

        {!authenticated ? (
          <div className="card text-center py-12 space-y-4">
            <h3 className="text-lg font-semibold text-text-primary">Sign in to View Contacts</h3>
            <p className="text-sm text-text-muted max-w-sm mx-auto">
              Your contact directory is scoped securely to your active Space.
            </p>
            <button onClick={login} className="btn-primary px-6 py-2.5 text-sm font-semibold">
              Sign In
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {showAddForm && (
              <RecipientForm
                onSuccess={(newRecipient) => {
                  setRecipients((prev) => [newRecipient, ...prev]);
                  setShowAddForm(false);
                }}
                onCancel={() => setShowAddForm(false)}
              />
            )}

            <PeopleList
              recipients={recipients}
              loading={loading}
              onRefresh={loadRecipients}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
