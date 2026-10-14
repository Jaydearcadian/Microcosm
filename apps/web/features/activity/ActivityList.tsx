"use client";

import React from "react";
import type { ActivityItem } from "@mcosm/api-contracts";

interface ActivityListProps {
  items: ActivityItem[];
  loading?: boolean;
  onRefresh?: () => void;
  onSelectPayment?: (paymentId: string) => void;
}

export function ActivityList({
  items,
  loading = false,
  onRefresh,
  onSelectPayment
}: ActivityListProps) {
  if (loading) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm text-text-muted animate-pulse">Loading activity stream...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card text-center py-12 space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-bg-surface text-text-muted">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-text-secondary">No activity yet in this Space.</p>
        <p className="text-xs text-text-muted max-w-sm mx-auto">
          Payments, intent evaluations, and wallet link challenges will appear here in chronological order.
        </p>
      </div>
    );
  }

  const getItemBadge = (type: string, status: string) => {
    switch (type) {
      case "payment_confirmed":
        return {
          icon: "✓",
          color: "text-emerald-400 bg-emerald-950/30 border-emerald-500/30",
          label: "Confirmed"
        };
      case "payment_submitted":
        return {
          icon: "↗",
          color: "text-blue-400 bg-blue-950/30 border-blue-500/30",
          label: "Submitted"
        };
      case "payment_failed":
        return {
          icon: "✕",
          color: "text-red-400 bg-red-950/30 border-red-500/30",
          label: "Failed"
        };
      case "wallet_linked":
        return {
          icon: "⚿",
          color: "text-purple-400 bg-purple-950/30 border-purple-500/30",
          label: "Wallet Linked"
        };
      case "recipient_added":
        return {
          icon: "+",
          color: "text-amber-400 bg-amber-950/30 border-amber-500/30",
          label: "Contact Added"
        };
      default:
        return {
          icon: "•",
          color: "text-text-muted bg-bg-surface border-border-subtle",
          label: status || type
        };
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Space Activity ({items.length})
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
        {items.map((item) => {
          const badge = getItemBadge(item.type, item.status);
          const paymentId = (item.details?.paymentId as string) || (item.details?.id as string) || null;
          const isClickable = !!paymentId && !!onSelectPayment;

          return (
            <div
              key={item.id}
              onClick={() => {
                if (isClickable && paymentId) onSelectPayment(paymentId);
              }}
              className={`p-4 flex items-center justify-between transition-colors ${
                isClickable ? "cursor-pointer hover:bg-bg-surface" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${badge.color}`}
                >
                  {badge.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {item.title}
                    </p>
                    <span className={`badge-surface text-[10px] font-mono px-1.5 py-0.5 border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  {item.subtitle && (
                    <p className="text-xs text-text-muted truncate max-w-[200px] sm:max-w-xs">
                      {item.subtitle}
                    </p>
                  )}
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              {isClickable && (
                <div className="flex items-center gap-1 text-xs text-text-muted shrink-0 pl-2">
                  <span>Receipt</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
