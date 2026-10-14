"use client";

import React, { useState } from "react";

export interface EnvelopeVault {
  id: string;
  name: string;
  asset: string;
  maxAmountPerTx: string;
  maxAmountPerDay: string;
  spentToday: string;
  allowedRecipientIds: string[];
  schedule: {
    days: string[];
    startHourUtc: number;
    endHourUtc: number;
  };
  activeAgentCount: number;
}

const DEFAULT_VAULTS: EnvelopeVault[] = [
  {
    id: "env_research_agents",
    name: "Autonomous Research Fleet",
    asset: "USDC",
    maxAmountPerTx: "25.00",
    maxAmountPerDay: "100.00",
    spentToday: "34.50",
    allowedRecipientIds: ["openai.mcosm", "anthropic.mcosm", "arxiv_api.mcosm"],
    schedule: {
      days: ["mon", "tue", "wed", "thu", "fri"],
      startHourUtc: 9,
      endHourUtc: 18
    },
    activeAgentCount: 3
  },
  {
    id: "env_cloud_infra",
    name: "Cloud & Compute Buffer",
    asset: "USDC",
    maxAmountPerTx: "150.00",
    maxAmountPerDay: "500.00",
    spentToday: "189.00",
    allowedRecipientIds: ["aws_infra.mcosm", "modal_compute.mcosm"],
    schedule: {
      days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      startHourUtc: 0,
      endHourUtc: 24
    },
    activeAgentCount: 2
  }
];

export function EnvelopeVaultList() {
  const [vaults] = useState<EnvelopeVault[]>(DEFAULT_VAULTS);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Active Policy Envelopes</h2>
          <p className="text-xs text-slate-400">Mathematical spending guardrails active in this Space.</p>
        </div>
        <button className="px-3.5 py-1.5 rounded-lg bg-cyan-950 border border-cyan-700/60 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/60 transition-all cursor-pointer">
          + New Policy Envelope
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {vaults.map((vault) => {
          const spentNum = parseFloat(vault.spentToday);
          const limitNum = parseFloat(vault.maxAmountPerDay);
          const pct = Math.min(100, Math.round((spentNum / limitNum) * 100));

          return (
            <div
              key={vault.id}
              className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between gap-5 hover-glow-card"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-white">{vault.name}</h3>
                      <span className="text-[11px] font-mono text-slate-400">{vault.id}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                    ACTIVE
                  </span>
                </div>

                {/* Burn Rate Velocity Bar */}
                <div className="flex flex-col gap-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Daily Burn Rate:</span>
                    <span className="text-white font-semibold">
                      ${vault.spentToday} / ${vault.maxAmountPerDay} {vault.asset} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct > 80 ? "bg-amber-400" : "bg-cyan-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Policy Specs */}
                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-mono">
                  <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-500 block">PER-TX CEILING</span>
                    <span className="text-slate-200 font-semibold">${vault.maxAmountPerTx} USDC</span>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-500 block">BOUND AGENTS</span>
                    <span className="text-slate-200 font-semibold">{vault.activeAgentCount} Autonomous</span>
                  </div>
                </div>

                {/* Operating Schedule Timeline */}
                <div className="flex flex-col gap-1 pt-1 text-[11px] font-mono">
                  <span className="text-slate-400">UTC Schedule Window:</span>
                  <div className="flex items-center gap-2 p-2 rounded bg-slate-950 border border-slate-800 text-slate-300">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>
                      {vault.schedule.startHourUtc.toString().padStart(2, "0")}:00 –{" "}
                      {vault.schedule.endHourUtc.toString().padStart(2, "0")}:00 UTC (
                      {vault.schedule.days.join(", ").toUpperCase()})
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>{vault.allowedRecipientIds.length} Allowlisted Vendors</span>
                <span className="text-cyan-400 hover:underline cursor-pointer">Edit Shield &rarr;</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
