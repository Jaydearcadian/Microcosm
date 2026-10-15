"use client";

import React, { useState } from "react";

type TabId = "ts" | "mcp" | "curl";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "ts", label: "TypeScript" },
  { id: "mcp", label: "MCP Server" },
  { id: "curl", label: "cURL API" }
];

const tsCode = `import { createClient } from "@mcosm/client";

// Initialize Microcosm inside your AI Agent workflow
const mcosm = createClient({
  spaceId: "space_growth_ai",
  accessToken: process.env.MCOSM_SESSION_TOKEN
});

// 1. Autonomous Agent declares a payment intent
const intent = await mcosm.intents.create({
  envelopeId: "env_daily_ops",
  recipientId: "rec_openai_billing",
  amount: "45.000000",
  asset: "USDC"
});

// 2. Verified against policy envelope:
if (intent.status === "approved") {
  // 3. Prepare client-signed calldata (No server keys needed!)
  const payment = await mcosm.payments.prepare({ intentId: intent.id });
  console.log("Ready to sign calldata:", payment.calldata);
}`;
const mcpCode = `{
  "mcpServers": {
    "microcosm": {
      "command": "npx",
      "args": ["-y", "@mcosm/mcp-server"],
      "env": {
        "MICROCOSM_SPACE_ID": "space_autonomous_research",
        "MICROCOSM_ENVELOPE_ID": "env_api_allowance",
        "ARC_CHAIN_ID": "5042"
      }
    }
  }
}`;
const curlCode = `# 1. Declare intent against envelope
curl -X POST https://microcosmonarc.vercel.app/v1/intents \\
  -H "Authorization: Bearer $SESSION_TOKEN" \\
  -H "x-space-id: space_marketing" \\
  -d '{
    "envelopeId": "env_advertising",
    "recipientId": "rec_google_ads",
    "amount": "150.000000",
    "asset": "USDC"
  }'

# 2. Inspect status (201 Created with status: "approved")`;

const SNIPPETS: Record<TabId, string> = {
  ts: tsCode,
  mcp: mcpCode,
  curl: curlCode
};

export function DeveloperTerminal() {
  const [activeTab, setActiveTab] = useState<TabId>("ts");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPETS[activeTab]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (insecure context, denied permission).
      // The snippet stays selectable in the <pre>, so the flow still works.
      setCopied(false);
    }
  };

        return (
    <section id="agents" className="py-24 px-4 max-w-6xl mx-auto w-full">
      <div className="flex flex-col gap-3 mb-12">
        <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
          AI Agent Integration
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Built for autonomous agent workflows
        </h2>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
          Connect Cursor, Claude Code, AutoGPT, or custom Python/TypeScript agents. Microcosm provides the policy guardrails and calldata synthesis.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-2xl">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/80 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-xs font-mono text-slate-400 ml-2">agent-runtime :: microcosm-sdk</span>
          </div>

          {/* Proper ARIA tablist (handoff §6): arrow-key navigation and a
              "n of 3, selected" announcement. Every tab keeps a 48px minimum
              hit area even though the visual pill is smaller. */}
          <div
            role="tablist"
            aria-label="Agent integration code samples"
            className="flex items-center gap-1 rounded-lg border border-ink/10 bg-canvas p-1"
          >
            {TABS.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`devtab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls="devtab-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(event) => {
                    const dir =
                      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                    if (!dir) return;
                    event.preventDefault();
                    const next =
                      TABS[(TABS.findIndex((t) => t.id === activeTab) + dir + TABS.length) % TABS.length];
                    setActiveTab(next.id);
                    document.getElementById(`devtab-${next.id}`)?.focus();
                  }}
                  className={`inline-flex min-h-[48px] items-center rounded px-3 font-mono text-xs font-medium transition-all duration-250 ease-[var(--ease-spring)] ${
                    selected
                      ? "border border-arc/50 bg-arc-soft text-arc"
                      : "border border-transparent text-ink-secondary hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Code View — the tabpanel referenced by aria-controls above */}
        <div
          id="devtab-panel"
          role="tabpanel"
          aria-labelledby={`devtab-${activeTab}`}
          tabIndex={0}
          className="relative bg-canvas/90"
        >
          {/* One-click copy with a 2000ms "COPIED" confirmation (handoff §3.6).
              The status is announced politely so it is not silently visual. */}
          <button
            type="button"
            onClick={handleCopy}
            className="absolute right-3 top-3 z-10 inline-flex min-h-[48px] items-center gap-1.5 rounded-lg border border-ink/15 bg-canvas-elevated/90 px-3 font-mono text-[11px] font-medium text-ink-secondary backdrop-blur-md transition-colors duration-250 ease-[var(--ease-spring)] hover:border-arc/50 hover:text-arc"
          >
            {copied ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                COPIED
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                COPY
              </>
            )}
          </button>

          <p role="status" aria-live="polite" className="sr-only">
            {copied ? "Code sample copied to clipboard" : ""}
          </p>

          {/* tab-size keeps the TypeScript/JSON snippets aligned; the region
              scrolls horizontally rather than wrapping mid-token on mobile. */}
          <div className="overflow-x-auto px-6 py-6 pr-24">
            <pre className="font-mono text-xs leading-relaxed text-ink-secondary sm:text-sm" style={{ tabSize: 2 }}>
              <code>{SNIPPETS[activeTab]}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
