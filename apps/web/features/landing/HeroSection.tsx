"use client";

import React, { useId, useState } from "react";
import { HeroMedia } from "./HeroMedia";

interface HeroSectionProps {
  onLaunchApp: () => void;
}

/**
 * HeroSection - asymmetric hero with the interactive Arc Cockpit frame.
 *
 * Implements docs/design-handoff.md section 3.2:
 *  - Grid: `1.15fr : 0.85fr` asymmetric split on desktop, single column when the
 *    container narrows. The split is driven by a container query
 *    (@container min-width 720px) so the hero reflows correctly even when nested
 *    in a narrower parent - Layer 2 of the responsive-craft escalation (handoff 7).
 *  - Motion: staggered entrance choreography (pill 80ms -> headline 160ms ->
 *    subcopy 240ms -> CTAs 320ms -> cockpit 400ms), opacity+translate only, so
 *    `prefers-reduced-motion` collapses to a pure opacity state with zero shift.
 *  - Accessibility: the cockpit is a labelled region, the policy verdict is an
 *    `aria-live="polite"` status, and every control is a >=48px touch target.
 */
export function HeroSection({ onLaunchApp }: HeroSectionProps) {
  // Simulator state inside the hero cockpit
  const [amount, setAmount] = useState<number>(25);
  const [isWeekday, setIsWeekday] = useState<boolean>(true);
  const [recipientApproved, setRecipientApproved] = useState<boolean>(true);

  // Policy rules in active envelope: env_agent_ops
  const maxPerTx = 50;
  const isApproved = amount <= maxPerTx && isWeekday && recipientApproved;

  const rejectionReason = !recipientApproved
    ? "Recipient not in envelope allowlist"
    : !isWeekday
      ? "Intent falls outside allowed schedule (Mon-Fri)"
      : amount > maxPerTx
        ? `Exceeds per-tx limit ($${maxPerTx}.00 USDC)`
        : null;

  // Calldata simulation - BigInt base units only, never floating point
  // (Definition of Done: zero unsafe floating-point math, handoff section 8).
  const dummyRecipientHex = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    .toLowerCase()
    .replace("0x", "")
    .padStart(64, "0");
  const baseUnitsHex = (BigInt(amount) * 1_000_000n).toString(16).padStart(64, "0");
  const simulatedCalldata = `0xa9059cbb${dummyRecipientHex.slice(0, 24)}...${baseUnitsHex.slice(-12)}`;

  const amountId = useId();
  const verdictId = useId();

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative mx-auto w-full max-w-[1280px] px-4 pb-16 pt-10 sm:pb-20 sm:pt-14"
    >
      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/4 h-72 w-3/4 -translate-x-1/2 rounded-full bg-gradient-to-r from-arc/15 via-ray/15 to-arc/15 blur-3xl"
        aria-hidden="true"
      />

      {/* Container-query context: the hero reflows on its OWN width, so it stays
          correct even when nested in a narrower parent (responsive-craft
          Layer 2). `@min-4xl:` is Tailwind v4's 56rem @container variant —
          emitted into `@layer utilities`, so it reliably overrides the
          `grid-cols-1` baseline below. A hand-written `@container` rule inside
          `@layer components` would lose the cascade and never engage.
          56rem (896px) is chosen deliberately: the two hero columns need ~830px
          of real content width, so splitting any earlier forces the 16:10 hero
          media to overflow the viewport (measured 41px of horizontal scroll at
          a 768px viewport with a 28rem breakpoint). */}
      <div className="@container relative">
        <div className="grid grid-cols-1 items-center gap-10 @min-4xl:grid-cols-[1.15fr_0.85fr] @min-4xl:gap-14">
          {/* ===== Left column: protocol value proposition ===== */}
          <div className="flex flex-col items-start gap-6">
            <p className="arc-enter inline-flex items-center gap-2 rounded-full border border-arc/30 bg-canvas-elevated/80 px-3.5 py-1.5 font-mono text-[11px] tracking-[0.14em] text-arc backdrop-blur-md [--arc-delay:80ms]">
              <span className="arc-pulse h-1.5 w-1.5 rounded-full bg-arc" aria-hidden="true" />
              ARC MAINNET · INTENT-BOUND FINANCIAL COORDINATION
            </p>

            <h1
              id="hero-heading"
              className="arc-enter font-display text-display font-bold leading-[1.05] tracking-[-0.04em] text-ink [--arc-delay:160ms]"
            >
              Programmable money for the{" "}
              <span className="bg-gradient-to-br from-ink via-arc to-ray bg-clip-text text-transparent">
                open internet.
              </span>
            </h1>

            <p className="arc-enter max-w-xl text-body leading-relaxed text-ink-secondary [--arc-delay:240ms]">
              Microcosm introduces <strong className="font-semibold text-ink">Spaces</strong> and{" "}
              <strong className="font-semibold text-ink">Programmable Envelopes</strong> - policy-bounded
              guardrails that let autonomous AI agents and organizations spend USDC on Arc
              without ever holding a master private key.
            </p>

            <div className="arc-enter flex w-full flex-col gap-3 pt-2 sm:w-auto sm:flex-row sm:items-center [--arc-delay:320ms]">
              <button
                type="button"
                onClick={onLaunchApp}
                className="group inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-semibold text-ink-inverse shadow-[var(--shadow-glow-cyan)] transition-all duration-300 ease-[var(--ease-spring)] hover:bg-arc-hover hover:text-ink-inverse active:scale-[0.98] sm:w-auto"
              >
                <span>Launch App</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="transition-transform duration-300 ease-[var(--ease-spring)] group-hover:translate-x-0.5"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>

              <a
                href="#simulator"
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-arc/35 bg-canvas-elevated/70 px-6 py-3.5 font-mono text-sm font-medium text-ink backdrop-blur-md transition-all duration-300 ease-[var(--ease-spring)] hover:border-arc/70 hover:bg-arc-soft sm:w-auto"
              >
                <span>Run a simulation</span>
                <span aria-hidden="true">→</span>
              </a>
            </div>

            {/* Proof strip */}
            <dl className="arc-enter grid w-full grid-cols-3 gap-4 border-t border-ink/10 pt-6 [--arc-delay:400ms]">
              {[
                { term: "Settlement", detail: "Arc USDC · chain 5042" },
                { term: "Finality", detail: "sub-second, deterministic" },
                { term: "Custody", detail: "non-custodial, fail-closed" }
              ].map((item) => (
                <div key={item.term} className="flex flex-col gap-1">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-tertiary">
                    {item.term}
                  </dt>
                  <dd className="font-mono text-[13px] leading-snug text-ink-secondary">
                    {item.detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* ===== Right column: hero media + interactive cockpit ===== */}
          <div className="arc-enter flex flex-col gap-5 [--arc-delay:400ms]">
            <HeroMedia />

            {/* Interactive Arc Cockpit - labelled region per handoff section 6 */}
            <div
              role="group"
              aria-labelledby="cockpit-title"
              className="cockpit-frame rounded-[var(--radius-lg)] bg-canvas-elevated/80 backdrop-blur-xl"
            >
              <div className="cockpit-header">
                <div className="flex items-center gap-2.5">
                  <span className="pulse-indicator" aria-hidden="true" />
                  <span
                    id="cockpit-title"
                    className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-secondary"
                  >
                    Live Policy Cockpit
                  </span>
                </div>
                <span className="font-mono text-[10px] text-ink-tertiary">policy-engine v1.0</span>
              </div>

              <div className="cockpit-body flex flex-col gap-4">
                {/* Amount slider - 48px touch target */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor={amountId}
                    className="flex min-h-[48px] items-center justify-between font-mono text-xs text-ink-secondary"
                  >
                    <span>Intent amount</span>
                    <span className="font-mono text-sm font-bold text-ink">
                      ${amount.toFixed(2)} USDC
                    </span>
                  </label>
                  <input
                    id={amountId}
                    type="range"
                    min={1}
                    max={150}
                    step={1}
                    value={amount}
                    onChange={(event) => setAmount(Number(event.target.value))}
                    aria-describedby={verdictId}
                    className="h-12 w-full cursor-pointer accent-arc"
                  />
                </div>

                {/* Recipient + schedule toggles */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setRecipientApproved((previous) => !previous)}
                    aria-pressed={recipientApproved}
                    className={`inline-flex min-h-[48px] items-center justify-between gap-2 rounded-lg border px-3 py-2 font-mono text-xs transition-all duration-300 ease-[var(--ease-spring)] ${
                      recipientApproved
                        ? "border-arc/60 bg-arc-soft text-arc"
                        : "border-danger/60 bg-danger/10 text-danger"
                    }`}
                  >
                    <span>Recipient</span>
                    <span className="font-bold">
                      {recipientApproved ? "Allowlisted" : "Unknown"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsWeekday((previous) => !previous)}
                    aria-pressed={isWeekday}
                    className={`inline-flex min-h-[48px] items-center justify-between gap-2 rounded-lg border px-3 py-2 font-mono text-xs transition-all duration-300 ease-[var(--ease-spring)] ${
                      isWeekday
                        ? "border-arc/60 bg-arc-soft text-arc"
                        : "border-danger/60 bg-danger/10 text-danger"
                    }`}
                  >
                    <span>Schedule</span>
                    <span className="font-bold">{isWeekday ? "14:30 UTC" : "03:15 UTC"}</span>
                  </button>
                </div>

                {/* Real-time policy verdict - polite live region */}
                <div
                  id={verdictId}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className={`flex flex-col gap-2.5 rounded-xl border p-4 transition-all duration-300 ease-[var(--ease-spring)] ${
                    isApproved
                      ? "border-success/40 bg-success/10 shadow-[0_0_30px_-8px] shadow-success/25"
                      : "border-danger/40 bg-danger/10 shadow-[0_0_30px_-8px] shadow-danger/25"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isApproved ? "arc-pulse bg-success" : "bg-danger"
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      className={`font-mono text-[11px] font-bold uppercase tracking-[0.1em] ${
                        isApproved ? "text-success" : "text-danger"
                      }`}
                    >
                      {isApproved
                        ? "Policy passed · intent approved"
                        : "Policy violated · intent blocked"}
                    </span>
                  </div>

                  {isApproved ? (
                    <ul className="flex flex-col gap-1.5 pt-1 font-mono text-[11px] text-ink-secondary">
                      <li className="flex items-center justify-between gap-3">
                        <span>Calldata</span>
                        <span className="truncate text-arc">{simulatedCalldata}</span>
                      </li>
                      <li className="flex items-center justify-between gap-3">
                        <span>Token contract</span>
                        <span className="text-ink-tertiary">0x3600…0000 (Arc USDC)</span>
                      </li>
                      <li className="flex items-center justify-between gap-3">
                        <span>Network fee</span>
                        <span className="font-semibold text-success">0.0001 USDC</span>
                      </li>
                    </ul>
                  ) : (
                    <p className="flex items-center gap-2 py-1 font-mono text-xs text-danger">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{rejectionReason}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
