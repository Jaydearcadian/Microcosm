"use client";

import React from "react";

/**
 * PrimitivesSection - the four architectural primitives (handoff 3.4).
 *
 *  - An ordered list (<ol>) because the primitives are a sequence, not a
 *    decorative grid; list semantics give screen readers "1 of 4" context.
 *  - `arc-glow-card` supplies the pointer-following radial border glow
 *    (design.md section 4) purely in CSS - the card only needs :hover/:focus-within.
 */
const PRIMITIVES = [
  {
    step: "01",
    title: "Multi-Tenant Spaces",
    desc: "Isolated financial operating environments. Every user, company department, and fleet of autonomous agents operates within its own Space with strict RBAC (Owner, Member, Viewer).",
    badge: "DATA & FUND ISOLATION",
    icon: (
      <>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </>
    )
  },
  {
    step: "02",
    title: "Programmable Envelopes",
    desc: "Mathematical policy envelopes that govern spending. Define asset restrictions, per-transaction maximums, daily velocity limits, allowed counterparties, and operating schedule windows.",
    badge: "POLICY GUARDRAILS",
    icon: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </>
    )
  },
  {
    step: "03",
    title: "Intent Authorization Engine",
    desc: "Decouples intent from execution. Autonomous agents submit transaction intents. The policy engine evaluates constraints and synthesizes unsigned calldata only if every check passes.",
    badge: "ZERO SERVER KEYS",
    icon: (
      <>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </>
    )
  },
  {
    step: "04",
    title: "Arc Onchain Settlement",
    desc: "Direct native settlement on Arc USDC (0x3600...0000) with sub-second finality and sub-cent fees. Pure BigInt base-unit precision with fail-closed receipt verification.",
    badge: "VERIFIED SETTLEMENT",
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </>
    )
  }
];

export function PrimitivesSection() {
  return (
    <section id="primitives" aria-labelledby="primitives-heading" className="mx-auto w-full max-w-[1280px] px-4 py-20 sm:py-24">
      <div className="mb-14 flex flex-col gap-3">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-arc">
          Core Primitives
        </p>
        <h2 id="primitives-heading" className="font-display text-h2 font-bold tracking-[-0.02em] text-ink">
          Architected for high-assurance finance
        </h2>
        <p className="max-w-2xl text-body leading-relaxed text-ink-secondary">
          Four modular primitives that transform raw blockchain transfers into policy-bound,
          safe financial operations.
        </p>
      </div>

      <ol className="grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2 md:gap-6">
        {PRIMITIVES.map((primitive) => (
          <li
            key={primitive.step}
            className="arc-glow-card group flex flex-col justify-between gap-6 rounded-[var(--radius-xl)] border border-ink/10 bg-canvas-elevated/50 p-7 transition-transform duration-300 ease-[var(--ease-spring)] hover:-translate-y-1 sm:p-8"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border border-arc/30 bg-arc-soft text-arc transition-colors duration-300 ease-[var(--ease-spring)] group-hover:border-arc/60">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {primitive.icon}
                  </svg>
                </span>
                <span className="font-mono text-2xl font-bold text-ink/15" aria-hidden="true">
                  {primitive.step}
                </span>
              </div>
              <h3 className="font-display text-h3 font-bold tracking-tight text-ink">
                {primitive.title}
              </h3>
              <p className="text-sm leading-relaxed text-ink-secondary">{primitive.desc}</p>
            </div>

            <p className="border-t border-ink/10 pt-4">
              <span className="rounded border border-ink/15 bg-canvas px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.1em] text-ink-secondary">
                {primitive.badge}
              </span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
