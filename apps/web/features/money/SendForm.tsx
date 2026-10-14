"use client";

import React, { useState } from "react";
import { parseUsdcBaseUnits, isValidRecipientFormat } from "./money-validation.ts";
import type { Recipient } from "@mcosm/api-contracts";

export interface SendFormData {
  recipient: string;
  recipientType: "address" | "email";
  amount: string;
  memo?: string;
}

interface SendFormProps {
  balanceAmount?: string;
  balanceBaseUnits?: bigint;
  recipients?: Recipient[];
  onSubmit: (data: SendFormData) => void;
  disabled?: boolean;
}

export function SendForm({
  balanceAmount = "0.00",
  balanceBaseUnits = 0n,
  recipients = [],
  onSubmit,
  disabled = false
}: SendFormProps) {
  const [recipientInput, setRecipientInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [memoInput, setMemoInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSelectContact = (r: Recipient) => {
    setRecipientInput(r.address || (r as any).lookupKey || r.displayLabel || "");
    setError(null);
  };

  const handleMaxAmount = () => {
    setAmountInput(balanceAmount);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedRecipient = recipientInput.trim();
    const recipientValidation = isValidRecipientFormat(trimmedRecipient);
    if (!recipientValidation.valid || !recipientValidation.type) {
      setError("Please provide a valid Arc EVM address (0x...) or email address.");
      return;
    }

    const amountValidation = parseUsdcBaseUnits(amountInput);
    if (!amountValidation.valid || amountValidation.baseUnits === undefined) {
      setError(amountValidation.error || "Please enter a valid USDC amount.");
      return;
    }

    if (amountValidation.baseUnits <= 0n) {
      setError("Payment amount must be greater than 0.");
      return;
    }

    if (balanceBaseUnits > 0n && amountValidation.baseUnits > balanceBaseUnits) {
      setError(`Insufficient balance. You have ${balanceAmount} USDC.`);
      return;
    }

    onSubmit({
      recipient: trimmedRecipient,
      recipientType: recipientValidation.type,
      amount: amountValidation.humanFormatted || amountInput.trim(),
      memo: memoInput.trim() || undefined
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-6">
      <div className="border-b border-border-subtle pb-4">
        <h2 className="text-xl font-semibold text-text-primary">Send USDC on Arc</h2>
        <p className="text-sm text-text-muted mt-1">
          Settles natively in Arc USDC (<code className="text-xs text-text-secondary">0x3600...0000</code>).
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Recipient Input */}
      <div>
        <label htmlFor="recipient" className="block text-sm font-medium text-text-secondary mb-1">
          Recipient (Address or Email)
        </label>
        <input
          id="recipient"
          type="text"
          value={recipientInput}
          onChange={(e) => {
            setRecipientInput(e.target.value);
            setError(null);
          }}
          placeholder="0x... or name@example.com"
          disabled={disabled}
          className="input-field text-sm"
          autoComplete="off"
          spellCheck={false}
          required
        />
        {recipients.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-text-muted">Saved people:</span>
            {recipients.slice(0, 4).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelectContact(r)}
                disabled={disabled}
                className="text-xs px-2 py-1 rounded bg-bg-surface hover:bg-bg-elevated border border-border-subtle text-text-secondary transition-colors"
              >
                {r.displayLabel || (r.address ? `${r.address.slice(0, 6)}...` : (r as any).lookupKey || "Contact")}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Amount Input */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label htmlFor="amount" className="block text-sm font-medium text-text-secondary">
            Amount (USDC)
          </label>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>Available: <strong className="text-text-primary">{balanceAmount} USDC</strong></span>
            <button
              type="button"
              onClick={handleMaxAmount}
              disabled={disabled || balanceBaseUnits <= 0n}
              className="text-primary-accent hover:underline font-semibold"
            >
              MAX
            </button>
          </div>
        </div>
        <div className="relative">
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => {
              setAmountInput(e.target.value);
              setError(null);
            }}
            placeholder="0.00"
            disabled={disabled}
            className="input-field text-lg font-mono font-medium pr-16"
            required
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-sm font-semibold text-text-secondary">
            USDC
          </div>
        </div>
      </div>

      {/* Memo / Reason */}
      <div>
        <label htmlFor="memo" className="block text-sm font-medium text-text-secondary mb-1">
          Note (Optional)
        </label>
        <input
          id="memo"
          type="text"
          value={memoInput}
          onChange={(e) => setMemoInput(e.target.value)}
          placeholder="e.g. Design review payment"
          disabled={disabled}
          className="input-field text-sm"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={disabled || !recipientInput || !amountInput}
        className="btn-primary w-full py-3 text-base flex justify-center items-center gap-2"
      >
        <span>Review Payment</span>
      </button>
    </form>
  );
}
