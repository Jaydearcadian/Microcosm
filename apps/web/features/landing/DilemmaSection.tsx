"use client";

import React from "react";

/**
 * DilemmaSection - unrestricted key risk vs. policy envelopes (handoff 3.4).
 *
 *  - A labelled <section> with list-based comparison so assistive tech can
 *    enumerate the tradeoffs rather than parsing decorative cards.
 *  - Semantic color carries meaning only (design.md Rule 2): danger marks the
 *    legacy risk column, success marks the Microcosm guarantee column.
 */
const RISKS = [
  "All-or-nothing signing privileges",
  "Zero spending limits or time windows",
  "No tenant or Space isolation",
  "Catastrophic unrecoverable exploit vector"
];

const GUARANTEES = [
  "Strict per-transaction and daily velocity caps",
  "Scheduled day & hour operating windows (UTC)",
  "Allowlisted counterparty recipient bounds",
  "Fail-closed onchain settlement on Arc USDC"
];

export function DilemmaSection() {
  return (
    <section aria-labelledby="dilemma-heading" className="mx-auto w-full max-w-[1280px] px-4 py-20 sm:py-24">
      <div className="mx-auto mb-14 flex max-w-2xl flex-col gap-3 text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-arc">
          The Architectural Dilemma
        </p>
        <h2 id="dilemma-heading" className="font-display text-h2 font-bold tracking-[-0.02em] text-ink">
          Why raw private keys fail autonomous agents
        </h2>
        <p className="text-body leading-relaxed text-ink-secondary">
          Traditional crypto forces a dangerous compromise: either give an AI agent unrestricted
          access to all your funds, or manually sign every transaction. Microcosm removes the
          tradeoff entirely.
        </p>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 md:gap-8">
        <article className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-[var(--radius-xl)] border border-danger/30 bg-gradient-to-b from-danger/10 to-canvas p-7 shadow-[var(--shadow-cockpit)] sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-danger/15 blur-2xl" aria-hidden="true" />
          <div className="flex flex-col gap-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-danger/40 bg-danger/15 text-danger">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <h3 className="font-display text-h3 font-bold text-ink">The Unrestricted Key Risk</h3>
            <p className="text-sm leading-relaxed text-ink-secondary">
              Handing an autonomous agent a private key grants unrestricted, irrevocable authority.
              A single hallucination, infinite loop, or prompt injection can drain an entire
              treasury in seconds.
            </p>
            <ul className="flex flex-col gap-3 pt-1 font-mono text-xs text-ink-secondary">
              {RISKS.map((risk) => (
                <li key={risk} className="flex items-center gap-2.5 text-danger">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" aria-hidden="true" />
                  {risk}
                </li>
              ))}
            </ul>
          </div>
          <p className="border-t border-danger/25 pt-4 font-mono text-[11px] font-semibold tracking-[0.1em] text-danger">
            TRADITIONAL APPROACH · HIGH CUSTODIAL RISK
          </p>
        </article>

        <article className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-[var(--radius-xl)] border border-arc/40 bg-gradient-to-b from-arc/15 to-canvas p-7 shadow-[var(--shadow-cockpit)] sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-arc/15 blur-2xl" aria-hidden="true" />
          <div className="flex flex-col gap-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-arc/40 bg-arc-soft text-arc">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <h3 className="font-display text-h3 font-bold text-ink">The Microcosm Solution</h3>
            <p className="text-sm leading-relaxed text-ink-secondary">
              Decouple intent from execution. Agents operate inside tenant-isolated Spaces governed
              by Programmable Envelopes. Calldata is generated only when every policy dimension
              evaluates to approved.
            </p>
            <ul className="flex flex-col gap-3 pt-1 font-mono text-xs text-ink-secondary">
              {GUARANTEES.map((guarantee) => (
                <li key={guarantee} className="flex items-center gap-2.5 text-success">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" aria-hidden="true" />
                  {guarantee}
                </li>
              ))}
            </ul>
          </div>
          <p className="border-t border-arc/30 pt-4 font-mono text-[11px] font-semibold tracking-[0.1em] text-arc">
            MICROCOSM · POLICY-BOUNDED NON-CUSTODIAL EXECUTION
          </p>
        </article>
      </div>
    </section>
  );
}
