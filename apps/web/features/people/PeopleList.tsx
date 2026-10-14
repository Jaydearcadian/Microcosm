"use client";

import React from "react";
import Link from "next/link";
import type { Recipient } from "@mcosm/api-contracts";

interface PeopleListProps {
  recipients: Recipient[];
  loading?: boolean;
  onRefresh?: () => void;
}

export function PeopleList({ recipients, loading = false, onRefresh }: PeopleListProps) {
  if (loading) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm text-text-muted animate-pulse">Loading contacts...</p>
      </div>
    );
  }

  if (recipients.length === 0) {
    return (
      <div className="card text-center py-12 space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-bg-surface text-text-muted">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-text-secondary">No contacts saved in this Space yet.</p>
        <p className="text-xs text-text-muted max-w-sm mx-auto">
          Add an Arc wallet or email recipient above to initiate faster intent-governed payments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Space Contacts ({recipients.length})
        </span>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-primary-accent hover:underline"
          >
            Refresh
          </button>
        )}
      </div>

      <div className="divide-y divide-border-subtle card p-0 overflow-hidden">
        {recipients.map((recipient) => {
          const isWallet = !!recipient.address;
          const display = recipient.displayLabel || (recipient as any).displayName || "Contact";
          const identifier = recipient.address || (recipient as any).lookupKey || (recipient as any).email || "";

          return (
            <div
              key={recipient.id}
              className="p-4 flex items-center justify-between hover:bg-bg-surface/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary-accent/10 border border-primary-accent/20 flex items-center justify-center text-primary-accent font-semibold text-sm shrink-0">
                  {display.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {display}
                    </p>
                    <span className="badge-surface text-[10px] uppercase font-mono px-1.5 py-0.5">
                      {recipient.recipientType || (isWallet ? "wallet" : "email")}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted font-mono truncate max-w-[200px] sm:max-w-xs">
                    {identifier}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/money?to=${encodeURIComponent(identifier)}`}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                >
                  <span>Send</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
