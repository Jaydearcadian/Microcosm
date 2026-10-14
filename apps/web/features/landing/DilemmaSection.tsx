"use client";

import React from "react";

export function DilemmaSection() {
  return (
    <section className="py-24 px-4 max-w-6xl mx-auto w-full">
      <div className="text-center max-w-2xl mx-auto mb-16 flex flex-col gap-3">
        <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
          The Architectural Dilemma
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Why raw private keys fail autonomous agents
        </h2>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
          Traditional crypto forces a dangerous compromise: either give an AI agent unrestricted access to all your funds, or manually sign every transaction. Microcosm solves this.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* Left: Raw Keys Vulnerability */}
        <div className="p-8 rounded-2xl bg-gradient-to-b from-rose-950/20 to-slate-950/60 border border-rose-900/30 flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col gap-5">
            <div className="w-10 h-10 rounded-xl bg-rose-900/40 border border-rose-700/50 flex items-center justify-center text-rose-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">The Unrestricted Key Risk</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Giving an autonomous agent a private key grants unrestricted, irrevocable authority. A single hallucination, infinite loop, or prompt injection can drain an entire treasury in seconds.
            </p>

            <ul className="flex flex-col gap-3 pt-2 text-xs font-mono text-slate-300">
              <li className="flex items-center gap-2.5 text-rose-300">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                All-or-nothing signing privileges
              </li>
              <li className="flex items-center gap-2.5 text-rose-300">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Zero spending limits or time windows
              </li>
              <li className="flex items-center gap-2.5 text-rose-300">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                No tenant or Space isolation
              </li>
              <li className="flex items-center gap-2.5 text-rose-300">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Catastrophic unrecoverable exploit vector
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-rose-900/30 text-[11px] font-mono text-rose-400">
            TRADITIONAL APPROACH: HIGH CUSTODIAL RISK
          </div>
        </div>

        {/* Right: Microcosm Envelopes Solution */}
        <div className="p-8 rounded-2xl bg-gradient-to-b from-cyan-950/25 to-slate-950/60 border border-cyan-800/40 flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col gap-5">
            <div className="w-10 h-10 rounded-xl bg-cyan-900/40 border border-cyan-700/50 flex items-center justify-center text-cyan-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">The Microcosm Solution</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              Decouple intent from execution. Agents operate inside tenant-isolated Spaces governed by Programmable Envelopes. Calldata is generated only when all policy dimensions evaluate to approved.
            </p>

            <ul className="flex flex-col gap-3 pt-2 text-xs font-mono text-slate-300">
              <li className="flex items-center gap-2.5 text-cyan-300">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Strict per-transaction and daily velocity caps
              </li>
              <li className="flex items-center gap-2.5 text-cyan-300">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Scheduled day & hour operating windows (UTC)
              </li>
              <li className="flex items-center gap-2.5 text-cyan-300">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Allowlisted counterparty recipient bounds
              </li>
              <li className="flex items-center gap-2.5 text-cyan-300">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Fail-closed onchain settlement on Arc USDC
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-cyan-900/40 text-[11px] font-mono text-cyan-400 font-semibold">
            MICROCOSM: POLICY-BOUNDED NON-CUSTODIAL EXECUTION
          </div>
        </div>
      </div>
    </section>
  );
}
