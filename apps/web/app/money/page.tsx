"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "../../components/AppShell.tsx";
import { PageHeader } from "../../components/PageHeader.tsx";
import { useSession } from "../../features/identity/IdentityProvider.tsx";
import { SendForm, type SendFormData } from "../../features/money/SendForm.tsx";
import { PaymentReview } from "../../features/money/PaymentReview.tsx";
import { PaymentProgress } from "../../features/money/PaymentProgress.tsx";
import { createApiClient } from "../../lib/api-client.ts";
import { parseUsdcBaseUnits } from "../../features/money/money-validation.ts";
import type { Recipient } from "@mcosm/api-contracts";

export default function MoneyPage() {
  const { authenticated, accessToken, activeSpace, login } = useSession();
  const [step, setStep] = useState<"form" | "review" | "progress">("form");
  const [formData, setFormData] = useState<SendFormData | null>(null);
  const [submission, setSubmission] = useState<{
    paymentId: string;
    txHash: string;
    chainId: number;
    amount: string;
    recipient: string;
  } | null>(null);

  const [balanceAmount, setBalanceAmount] = useState("0.00");
  const [balanceBaseUnits, setBalanceBaseUnits] = useState(0n);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authenticated || !accessToken) return;

    let mounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const api = createApiClient({
          getAccessToken: () => accessToken,
          getSpaceId: () => activeSpace?.id
        });

        const [balRes, recRes] = await Promise.allSettled([
          api.getBalance("USDC"),
          api.listRecipients()
        ]);

        if (mounted && balRes.status === "fulfilled" && balRes.value) {
          const amt = balRes.value.amountDecimal || "0.00";
          setBalanceAmount(amt);
          if (balRes.value.amountBaseUnits) {
            setBalanceBaseUnits(BigInt(balRes.value.amountBaseUnits));
          } else {
            const parsed = parseUsdcBaseUnits(amt);
            setBalanceBaseUnits(parsed.baseUnits ?? 0n);
          }
        }

        if (mounted && recRes.status === "fulfilled" && Array.isArray(recRes.value)) {
          setRecipients(recRes.value);
        }
      } catch (e) {
        console.warn("Failed to fetch balance or contacts", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [authenticated, accessToken, activeSpace?.id]);

  return (
    <AppShell activeRoute="/money">
      <div className="max-w-xl mx-auto space-y-6">
        <PageHeader
          title="Money & Payments"
          subtitle="Intent-bound, client-authorized programmable settlement on Arc."
        />

        {!authenticated ? (
          <div className="card text-center py-12 space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-accent/10 text-primary-accent mb-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary">Sign in to Access Payments</h3>
            <p className="text-sm text-text-muted max-w-sm mx-auto">
              Connect your verified session to manage your Arc USDC balance and execute intent-governed payments.
            </p>
            <button onClick={login} className="btn-primary px-6 py-2.5 text-sm font-semibold">
              Sign In
            </button>
          </div>
        ) : (
          <div>
            {step === "form" && (
              <SendForm
                balanceAmount={balanceAmount}
                balanceBaseUnits={balanceBaseUnits}
                recipients={recipients}
                onSubmit={(data) => {
                  setFormData(data);
                  setStep("review");
                }}
                disabled={loading}
              />
            )}

            {step === "review" && formData && (
              <PaymentReview
                data={formData}
                onBack={() => setStep("form")}
                onSubmitted={(sub) => {
                  setSubmission(sub);
                  setStep("progress");
                }}
              />
            )}

            {step === "progress" && submission && (
              <PaymentProgress
                submission={submission}
                onReset={() => {
                  setFormData(null);
                  setSubmission(null);
                  setStep("form");
                }}
              />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
