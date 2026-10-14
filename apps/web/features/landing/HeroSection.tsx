"use client";

import React, { useState } from "react";

interface HeroSectionProps {
  onLaunchApp: () => void;
}

export function HeroSection({ onLaunchApp }: HeroSectionProps) {
  // Simulator State inside the hero cockpit
  const [amount, setAmount] = useState<number>(25);
  const [isWeekday, setIsWeekday] = useState<boolean>(true);
  const [recipientApproved, setRecipientApproved] = useState<boolean>(true);

  // Policy rules in active envelope: env_agent_ops
  const maxPerTx = 50;
  const isApproved = amount <= maxPerTx && isWeekday && recipientApproved;

  const rejectionReason = !recipientApproved
    ? "Recipient not in envelope allowlist"
    : !isWeekday
    ? "Intent falls outside allowed schedule (Mon–Fri)"
    : amount > maxPerTx
    ? `Exceeds per-tx limit ($${maxPerTx}.00 USDC)`
    : null;

  // Calldata simulation
  const dummyRecipientHex = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e".toLowerCase().replace("0x", "").padStart(64, "0");
  const baseUnitsHex = (BigInt(amount) * 1_000_000n).toString(16).padStart(64, "0");
  const simulatedCalldata = `0xa9059cbb${dummyRecipientHex.slice(0, 24)}...${baseUnitsHex.slice(-12)}`;

  return (
    <section className="relative pt-12 pb-20 px-4 max-w-6xl mx-auto w-full">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-3/4 h-72 bg-gradient-to-r from-cyan-600/15 via-indigo-600/15 to-purple-600/15 blur-3xl pointer-events-none rounded-full" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Column: Value Proposition */}
        <div className="lg:col-span-6 flex flex-col items-start gap-6 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/80 text-xs font-mono text-slate-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Arc Mainnet 5042 • Native USDC Settlement</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1]">
            Programmable money for the{" "}
            <span className="iridescent-text">open internet.</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            Microcosm introduces <strong className="text-white font-semibold">Spaces</strong> and{" "}
            <strong className="text-white font-semibold">Programmable Envelopes</strong>—policy-bounded guardrails that allow autonomous AI agents and organizations to spend USDC on Arc without holding master private keys.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2 w-full sm:w-auto">
            <button
              onClick={onLaunchApp}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-white via-slate-100 to-slate-200 text-slate-950 hover:to-white transition-all shadow-lg hover:shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Launch App</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>

            <a
              href="#simulator"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-medium text-sm bg-slate-900/80 hover:bg-slate-800/90 text-slate-200 border border-slate-700/80 transition-all text-center"
            >
              Explore Policy Engine
            </a>
          </div>

          <div className="flex items-center gap-6 pt-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Zero Custodial Keys</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Sub-Second Finality</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>&lt; $0.0001 Gas</span>
            </div>
          </div>
        </div>

        {/* Right Column: Hero Visual Cockpit (Option 2B + 7C) */}
        <div className="lg:col-span-6 z-10">
          <div className="cockpit-frame shadow-2xl">
            {/* Window Header */}
            <div className="cockpit-header">
              <div className="flex items-center gap-2">
                <div className="cockpit-dots">
                  <div className="cockpit-dot bg-rose-500/80" />
                  <div className="cockpit-dot bg-amber-500/80" />
                  <div className="cockpit-dot bg-emerald-500/80" />
                </div>
                <span className="text-xs font-mono text-slate-400 ml-2">
                  mcosm-cockpit :: active-space
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                <span className="pulse-indicator" />
                <span>ONLINE (CHAIN 5042)</span>
              </div>
            </div>

            {/* Cockpit Content */}
            <div className="cockpit-body flex flex-col gap-5">
              {/* Telemetry metadata */}
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] font-mono">
                <div>
                  <span className="text-slate-500 block">CALLER</span>
                  <span className="text-slate-200 font-medium">agent_research_01</span>
                </div>
                <div>
                  <span className="text-slate-500 block">POLICY SHIELD</span>
                  <span className="text-slate-200 font-medium">env_agent_ops</span>
                </div>
                <div>
                  <span className="text-slate-500 block">SETTLEMENT</span>
                  <span className="text-cyan-400 font-medium">Arc USDC Native</span>
                </div>
              </div>

              {/* Interactive Controls */}
              <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Test Intent Amount:</span>
                  <span className="font-mono text-white font-bold bg-slate-800 px-2.5 py-0.5 rounded border border-slate-700">
                    ${amount}.00 USDC
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={200}
                  step={5}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>$10 (Within limit)</span>
                  <span className="text-amber-400/90 font-mono">Cap: $50.00/tx</span>
                  <span>$200 (Violates policy)</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsWeekday(!isWeekday)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-mono border transition-all text-left flex items-center justify-between ${
                      isWeekday
                        ? "bg-cyan-950/40 border-cyan-700/60 text-cyan-300"
                        : "bg-rose-950/40 border-rose-800/60 text-rose-300"
                    }`}
                  >
                    <span>Schedule:</span>
                    <span className="font-bold">{isWeekday ? "Weekday (Allowed)" : "Weekend (Blocked)"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecipientApproved(!recipientApproved)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-mono border transition-all text-left flex items-center justify-between ${
                      recipientApproved
                        ? "bg-cyan-950/40 border-cyan-700/60 text-cyan-300"
                        : "bg-rose-950/40 border-rose-800/60 text-rose-300"
                    }`}
                  >
                    <span>Recipient:</span>
                    <span className="font-bold">{recipientApproved ? "Allowlisted" : "Unknown"}</span>
                  </button>
                </div>
              </div>

              {/* Real-Time Policy Evaluation Display */}
              <div
                className={`p-4 rounded-xl border transition-all flex flex-col gap-2.5 ${
                  isApproved
                    ? "bg-emerald-950/30 border-emerald-500/40 shadow-emerald-950/30 shadow-lg"
                    : "bg-rose-950/30 border-rose-500/40 shadow-rose-950/30 shadow-lg"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isApproved ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
                      }`}
                    />
                    <span
                      className={`text-xs font-mono font-bold uppercase tracking-wider ${
                        isApproved ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isApproved ? "Policy Passed • Intent Approved" : "Policy Violated • Intent Blocked"}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    policy-engine: v1.0
                  </span>
                </div>

                {isApproved ? (
                  <div className="flex flex-col gap-1.5 font-mono text-[11px] pt-1">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Synthesized Calldata:</span>
                      <span className="text-cyan-300 truncate max-w-[200px]">{simulatedCalldata}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Target Token Contract:</span>
                      <span className="text-slate-400">0x3600...0000 (Arc USDC)</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Estimated Network Fee:</span>
                      <span className="text-emerald-400 font-semibold">0.0001 USDC</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-rose-300 flex items-center gap-2 py-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{rejectionReason}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
