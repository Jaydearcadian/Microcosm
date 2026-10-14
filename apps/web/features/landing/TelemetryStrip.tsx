"use client";

import React from "react";

export function TelemetryStrip() {
  const metrics = [
    {
      label: "Settlement Rail",
      value: "Arc Mainnet",
      sub: "Chain ID 5042",
      badge: "LIVE"
    },
    {
      label: "Official Gas Asset",
      value: "USDC Native",
      sub: "0x3600...0000",
      badge: "6 DECIMALS"
    },
    {
      label: "Block Finality",
      value: "< 1.0s",
      sub: "Instant Settlement",
      badge: "FAST"
    },
    {
      label: "Average Gas Fee",
      value: "< $0.0001",
      sub: "Sub-cent Economics",
      badge: "PREDICTABLE"
    },
    {
      label: "Verified Onchain Proof",
      value: "Block 67174208",
      sub: "Tx 0xb9ff...21be408",
      badge: "VERIFIED"
    }
  ];

  return (
    <div id="telemetry" className="w-full border-y border-slate-800/80 bg-slate-950/40 py-8 px-4 backdrop-blur-md">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {metrics.map((m, idx) => (
          <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 hover-glow-card">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{m.label}</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40 font-semibold">
                {m.badge}
              </span>
            </div>
            <span className="text-lg font-bold font-mono text-white tracking-tight">{m.value}</span>
            <span className="text-xs font-mono text-slate-500 truncate">{m.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
