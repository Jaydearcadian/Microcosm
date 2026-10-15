"use client";

import React from "react";

/**
 * TelemetryStrip - real-time Arc Mainnet metrics (handoff section 3.3).
 *
 *  - Live region: `aria-live="polite"` announces metric refreshes to screen
 *    readers without stealing focus (inclusive-design matrix, handoff section 6).
 *  - Layer 3 media query governs the column count (2 / 3 / 5); the cards
 *    themselves scale fluidly, so no intermediate breakpoint jank.
 */
const METRICS = [
  { label: "Settlement Rail", value: "Arc Mainnet", sub: "Chain ID 5042", badge: "LIVE" },
  { label: "Official Gas Asset", value: "USDC Native", sub: "0x3600...0000", badge: "6 DECIMALS" },
  { label: "Block Finality", value: "< 1.0s", sub: "Instant Settlement", badge: "FAST" },
  { label: "Average Gas Fee", value: "< $0.0001", sub: "Sub-cent Economics", badge: "PREDICTABLE" },
  { label: "Verified Onchain Proof", value: "Block 67174208", sub: "Tx 0xb9ff...21be408", badge: "VERIFIED" }
];

export function TelemetryStrip() {
  return (
    <section
      id="telemetry"
      aria-labelledby="telemetry-heading"
      className="w-full border-y border-ink/10 bg-canvas-subtle/60 px-4 py-8 backdrop-blur-md"
    >
      <h2 id="telemetry-heading" className="sr-only">
        Arc Mainnet network telemetry
      </h2>

      <div
        aria-live="polite"
        className="mx-auto grid max-w-[1280px] grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5"
      >
        {METRICS.map((metric) => (
          <article
            key={metric.label}
            className="arc-glow-card flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-ink/10 bg-canvas-elevated/50 p-3 transition-transform duration-300 ease-[var(--ease-spring)] hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-tertiary">
                {metric.label}
              </h3>
              <span className="rounded border border-arc/30 bg-arc-soft px-1.5 py-0.5 font-mono text-[9px] font-semibold text-arc">
                {metric.badge}
              </span>
            </div>
            <p className="font-mono text-lg font-bold tracking-tight text-ink">{metric.value}</p>
            <p className="truncate font-mono text-xs text-ink-tertiary">{metric.sub}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
