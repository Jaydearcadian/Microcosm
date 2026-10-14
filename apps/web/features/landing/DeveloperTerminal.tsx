"use client";

import React, { useState } from "react";

export function DeveloperTerminal() {
  const [activeTab, setActiveTab] = useState<"ts" | "mcp" | "curl">("ts");

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

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab("ts")}
              className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all ${
                activeTab === "ts" ? "bg-cyan-950 text-cyan-400 border border-cyan-800/60" : "text-slate-400 hover:text-white"
              }`}
            >
              TypeScript
            </button>
            <button
              onClick={() => setActiveTab("mcp")}
              className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all ${
                activeTab === "mcp" ? "bg-cyan-950 text-cyan-400 border border-cyan-800/60" : "text-slate-400 hover:text-white"
              }`}
            >
              MCP Server
            </button>
            <button
              onClick={() => setActiveTab("curl")}
              className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all ${
                activeTab === "curl" ? "bg-cyan-950 text-cyan-400 border border-cyan-800/60" : "text-slate-400 hover:text-white"
              }`}
            >
              cURL API
            </button>
          </div>
        </div>

        {/* Code View */}
        <div className="p-6 font-mono text-xs sm:text-sm text-slate-300 overflow-x-auto leading-relaxed bg-slate-950/90">
          <pre>
            <code>{activeTab === "ts" ? tsCode : activeTab === "mcp" ? mcpCode : curlCode}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
