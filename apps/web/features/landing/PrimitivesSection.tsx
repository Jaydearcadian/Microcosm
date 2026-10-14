"use client";

import React from "react";

export function PrimitivesSection() {
  const primitives = [
    {
      step: "01",
      title: "Multi-Tenant Spaces",
      desc: "Isolated financial operating environments. Every user, company department, and fleet of autonomous agents operates within its own Space with strict RBAC (Owner, Member, Viewer).",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
      badge: "DATA & FUND ISOLATION"
    },
    {
      step: "02",
      title: "Programmable Envelopes",
      desc: "Mathematical policy envelopes that govern spending. Define asset restrictions, per-transaction maximums, daily velocity limits, allowed counterparties, and operating schedule windows.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      ),
      badge: "POLICY GUARDRAILS"
    },
    {
      step: "03",
      title: "Intent Authorization Engine",
      desc: "Decouples intent from execution. Autonomous agents submit transaction intents. The policy engine evaluates constraints in memory and synthesizes unsigned calldata only if all checks pass.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
      badge: "ZERO SERVER KEYS"
    },
    {
      step: "04",
      title: "Arc Onchain Settlement",
      desc: "Direct native settlement on Arc USDC (0x3600...0000) with sub-second finality and sub-cent fees. Pure BigInt base-unit precision with zero floating-point math and fail-closed receipt verification.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
      badge: "VERIFIED SETTLEMENT"
    }
  ];

  return (
    <section id="primitives" className="py-24 px-4 max-w-6xl mx-auto w-full">
      <div className="flex flex-col gap-3 mb-16">
        <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
          Core Primitives
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Architected for high-assurance finance
        </h2>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
          Four modular primitives that transform raw blockchain transfers into policy-bound, safe financial operations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {primitives.map((p, idx) => (
          <div
            key={idx}
            className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col justify-between gap-6 hover-glow-card"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-cyan-400">
                  {p.icon}
                </div>
                <span className="font-mono text-2xl font-bold text-slate-700">{p.step}</span>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">{p.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{p.desc}</p>
            </div>

            <div className="pt-4 border-t border-slate-800/80">
              <span className="text-[10px] font-mono font-semibold tracking-wider px-2.5 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800">
                {p.badge}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
