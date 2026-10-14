"use client";

import React, { useState } from "react";
import { createApiClient, ApiClientError } from "../../lib/api-client.ts";
import { useSession } from "../identity/IdentityProvider.tsx";
import { isValidRecipientFormat } from "../money/money-validation.ts";
import type { Recipient } from "@mcosm/api-contracts";

interface RecipientFormProps {
  onSuccess: (recipient: Recipient) => void;
  onCancel?: () => void;
}

export function RecipientForm({ onSuccess, onCancel }: RecipientFormProps) {
  const { accessToken, activeSpace } = useSession();
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setError("Please sign in to add contacts.");
      return;
    }

    const trimmedTarget = target.trim();
    const validation = isValidRecipientFormat(trimmedTarget);
    if (!validation.valid || !validation.type) {
      setError("Please enter a valid Arc EVM address (0x...) or email address.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const api = createApiClient({
        getAccessToken: () => accessToken,
        getSpaceId: () => activeSpace?.id
      });

      const res = await api.createRecipient({
        displayLabel: label.trim() || trimmedTarget,
        recipientType: validation.type === "address" ? "wallet" : "email",
        address: validation.type === "address" ? (trimmedTarget as `0x${string}`) : undefined,
        spaceId: activeSpace?.id
      });

      if (res && res.recipient) {
        onSuccess(res.recipient);
        setLabel("");
        setTarget("");
      } else {
        throw new Error("Failed to create recipient contact.");
      }
    } catch (err: any) {
      console.error("Recipient creation error:", err);
      let msg = err.message || "Failed to save contact.";
      if (err instanceof ApiClientError) {
        msg = `[${err.code}] ${err.message}`;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="border-b border-border-subtle pb-3">
        <h3 className="text-base font-semibold text-text-primary">Add Contact</h3>
        <p className="text-xs text-text-muted mt-0.5">
          Save an Arc address or email contact to this Space.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-400">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="contact-label" className="block text-xs font-medium text-text-secondary mb-1">
          Name / Nickname
        </label>
        <input
          id="contact-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Alice, Supplier A"
          className="input-field text-sm"
          required
        />
      </div>

      <div>
        <label htmlFor="contact-target" className="block text-xs font-medium text-text-secondary mb-1">
          Arc Address or Email
        </label>
        <input
          id="contact-target"
          type="text"
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            setError(null);
          }}
          placeholder="0x... or alice@example.com"
          className="input-field text-sm font-mono"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>

      <div className="flex gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="btn-secondary flex-1 py-2 text-xs"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || !label || !target}
          className="btn-primary flex-1 py-2 text-xs font-semibold"
        >
          {submitting ? "Saving..." : "Save Contact"}
        </button>
      </div>
    </form>
  );
}
