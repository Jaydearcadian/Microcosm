"use client";

import React, { useState } from "react";
import { AppShell } from "../components/AppShell.tsx";
import { HomeOverview } from "../features/home/HomeOverview.tsx";
import { useSession } from "../features/identity/IdentityProvider.tsx";
import { LandingNav } from "../features/landing/LandingNav.tsx";
import { HeroSection } from "../features/landing/HeroSection.tsx";
import { TelemetryStrip } from "../features/landing/TelemetryStrip.tsx";
import { DilemmaSection } from "../features/landing/DilemmaSection.tsx";
import { PrimitivesSection } from "../features/landing/PrimitivesSection.tsx";
import { InteractiveSimulator } from "../features/landing/InteractiveSimulator.tsx";
import { DeveloperTerminal } from "../features/landing/DeveloperTerminal.tsx";
import { LandingFooter } from "../features/landing/LandingFooter.tsx";

export default function HomePage() {
  const { authenticated, user, activeSpace, login } = useSession();
  const [viewMode, setViewMode] = useState<"landing" | "app">("landing");

  const handleLaunchApp = () => {
    if (!authenticated) {
      login();
    }
    setViewMode("app");
  };

  return (
    <main className="min-h-screen bg-[#090b12] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Banner Mode Switcher for Judges & Reviewers */}
      <div className="w-full bg-slate-950/90 border-b border-slate-800/80 py-1.5 px-4 z-50 text-xs font-mono flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-slate-400">Microcosm Arc Mainnet v0.1:</span>
          <span className="text-white font-semibold">{viewMode === "landing" ? "Landing Page View" : "In-App Cockpit View"}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === "landing" ? "app" : "landing")}
            className="px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>Switch to {viewMode === "landing" ? "In-App Cockpit" : "Landing Page"}</span>
            <span className="text-[10px]">&rarr;</span>
          </button>
        </div>
      </div>

      {viewMode === "landing" ? (
        <div className="flex flex-col w-full relative grid-bg-pattern">
          {/* Floating Navigation Bar */}
          <LandingNav onLaunchApp={handleLaunchApp} isAuthenticated={authenticated} />

          {/* Hero Section with Asymmetric Cockpit Simulator */}
          <HeroSection onLaunchApp={handleLaunchApp} />

          {/* Live Arc Telemetry Bar */}
          <TelemetryStrip />

          {/* Core Dilemma: Keys vs Envelopes */}
          <DilemmaSection />

          {/* Four Core Primitives */}
          <PrimitivesSection />

          {/* Full Interactive Policy Simulator */}
          <InteractiveSimulator />

          {/* AI Agent & Developer Integration */}
          <DeveloperTerminal />

          {/* Footer */}
          <LandingFooter />
        </div>
      ) : (
        <AppShell
          activeSpaceName={activeSpace?.name || "Personal Space"}
          principalHandle={user?.id}
        >
          <div className="mb-4">
            <button
              onClick={() => setViewMode("landing")}
              className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1 mb-2 cursor-pointer"
            >
              <span>&larr; Back to Landing Page</span>
            </button>
          </div>
          <HomeOverview />
        </AppShell>
      )}
    </main>
  );
}
