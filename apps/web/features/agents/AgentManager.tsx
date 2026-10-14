"use client";

import React, { useState } from "react";

export interface RegisteredAgent {
  id: string;
  name: string;
  model: string;
  boundEnvelopeId: string;
  lastActive: string;
  status: "active" | "paused";
}

const DEFAULT_AGENTS: RegisteredAgent[] = [
  {
    id: "agent_claude_research",
    name: "Claude Code Deep Research",
    model: "claude-3-7-sonnet",
    boundEnvelopeId: "env_research_agents",
    lastActive: "14 mins ago",
    status: "active"
  },
  {
    id: "agent_cursor_copilot",
    name: "Cursor Development Pipeline",
    model: "gpt-4o",
    boundEnvelopeId: "env_cloud_infra",
    lastActive: "2 hours ago",
    status: "active"
  }
];

export function AgentManager() {
  const [agents, setAgents] = useState<RegisteredAgent[]>(DEFAULT_AGENTS);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [newAgentName, setNewAgentName] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("claude-3-7-sonnet");

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) return;

    const newAgent: RegisteredAgent = {
      id: `agent_${newAgentName.toLowerCase().replace(/\s+/g, "_")}`,
      name: newAgentName.trim(),
      model: selectedModel,
      boundEnvelopeId: "env_research_agents",
      lastActive: "Just now",
      status: "active"
    };

    setAgents([newAgent, ...agents]);
    setNewAgentName("");
    setShowModal(false);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Autonomous AI Agents</h2>
          <p className="text-xs text-slate-400">Manage agents authorized to spend within this Space's envelopes.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 text-xs font-semibold text-white hover:opacity-90 transition-all shadow-md cursor-pointer"
        >
          + Register AI Agent
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover-glow-card"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <circle cx="12" cy="5" r="2" />
                  <path d="M12 7v4" />
                  <line x1="8" y1="16" x2="8" y2="16" />
                  <line x1="16" y1="16" x2="16" y2="16" />
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-white">{agent.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {agent.model}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-0.5">
                  <span>ID: {agent.id}</span>
                  <span>•</span>
                  <span>Shield: {agent.boundEnvelopeId}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-slate-400">Active {agent.lastActive}</span>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40 font-bold">
                AUTHORIZED
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Register Agent Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Register Autonomous Agent</h3>
            <p className="text-xs text-slate-400">
              Assign an agent to a policy envelope. The agent will receive an intent authorization token without holding private keys.
            </p>

            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-300">Agent Label / Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Claude Deep Research"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-300">Agent Framework / Model:</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none font-mono"
                >
                  <option value="claude-3-7-sonnet">Claude 3.7 Sonnet (Anthropic)</option>
                  <option value="gpt-4o">GPT-4o (OpenAI)</option>
                  <option value="deepseek-r1">DeepSeek R1</option>
                  <option value="custom-mcp">Custom MCP Client</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md"
                >
                  Generate Agent Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
