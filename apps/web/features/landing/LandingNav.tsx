"use client";

import React from "react";
import Link from "next/link";

interface LandingNavProps {
  onLaunchApp: () => void;
  isAuthenticated?: boolean;
}

export function LandingNav({ onLaunchApp, isAuthenticated }: LandingNavProps) {
  return (
    <header className="sticky top-4 z-50 px-4 max-w-6xl mx-auto w-full transition-all">
      <nav className="glass-pill px-5 py-3 flex items-center justify-between shadow-lg">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shadow-md">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
            Microcosm
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
              v0.1 Arc
            </span>
          </span>
        </div>

        {/* Anchor Links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <a href="#simulator" className="hover:text-cyan-400 transition-colors">
            Policy Simulator
          </a>
          <a href="#primitives" className="hover:text-cyan-400 transition-colors">
            Primitives
          </a>
          <a href="#agents" className="hover:text-cyan-400 transition-colors">
            AI Agents
          </a>
          <a href="#telemetry" className="hover:text-cyan-400 transition-colors">
            Arc Telemetry
          </a>
        </div>

        {/* Live Network & CTA */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 text-xs font-mono text-slate-300">
            <span className="pulse-indicator" />
            <span>Arc 5042</span>
          </div>

          <button
            onClick={onLaunchApp}
            className="px-4 py-2 rounded-full text-xs sm:text-sm font-semibold bg-white text-slate-950 hover:bg-slate-200 transition-all shadow-md hover:shadow-cyan-500/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            {isAuthenticated ? "Go to Dashboard" : "Launch App"}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </nav>
    </header>
  );
}
