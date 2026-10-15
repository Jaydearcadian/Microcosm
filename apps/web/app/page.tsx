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

/**
 * HomePage - Layer 0 public marketing surface + Layer 1 in-app cockpit.
 *
 * Topology per docs/design-handoff.md section 2: the landing experience and the
 * authenticated cockpit share one design-token layer, so crossing the boundary
 * produces zero context shock. A persistent switcher lets reviewers traverse both.
 *
 * Accessibility: a skip link jumps past the switcher straight to the landing
 * content, and the marketing surface is wrapped in a single <main> landmark.
 */
export default function HomePage() {
  const { authenticated, user, activeSpace, login } = useSession();
  const [viewMode, setViewMode] = useState<"landing" | "app">("landing");

  const handleLaunchApp = () => {
    if (!authenticated) {
      login();
    }
    setViewMode("app");
  };

  const nextMode = viewMode === "landing" ? "app" : "landing";
  const nextModeLabel = viewMode === "landing" ? "In-App Cockpit" : "Landing Page";

  return (
    <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink selection:bg-arc/30 selection:text-ink">
      <a
        href="#landing-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:min-h-[48px] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-3 focus:font-mono focus:text-sm focus:font-semibold focus:text-ink-inverse"
      >
        Skip to main content
      </a>

      {/* Viewport switcher for judges & reviewers */}
      <div className="relative z-50 w-full border-b border-ink/10 bg-canvas/90 px-4 py-1.5">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 font-mono text-xs">
          <p className="flex items-center gap-2">
            <span className="arc-pulse h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
            <span className="text-ink-secondary">Microcosm Arc Mainnet v0.1:</span>
            <span className="font-semibold text-ink" aria-live="polite">
              {viewMode === "landing" ? "Landing Page View" : "In-App Cockpit View"}
            </span>
          </p>

          <button
            type="button"
            onClick={() => setViewMode(nextMode)}
            className="inline-flex min-h-[48px] shrink-0 items-center gap-1.5 rounded border border-ink/15 bg-canvas-elevated px-2.5 text-arc transition-colors duration-250 ease-[var(--ease-spring)] hover:border-arc/50"
          >
            <span>Switch to {nextModeLabel}</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </div>

      {viewMode === "landing" ? (
        <main id="landing-content" className="grid-bg-pattern relative flex w-full flex-col">
          <LandingNav onLaunchApp={handleLaunchApp} isAuthenticated={authenticated} />
          <HeroSection onLaunchApp={handleLaunchApp} />
          <TelemetryStrip />
          <DilemmaSection />
          <PrimitivesSection />
          <InteractiveSimulator />
          <DeveloperTerminal />
          <LandingFooter />
        </main>
      ) : (
        <main id="landing-content" className="flex w-full flex-1 flex-col">
          <AppShell
            activeSpaceName={activeSpace?.name || "Personal Space"}
            principalHandle={user?.id}
          >
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setViewMode("landing")}
                className="inline-flex min-h-[48px] items-center gap-1 font-mono text-xs text-arc transition-opacity duration-250 ease-[var(--ease-spring)] hover:opacity-80"
              >
                <span aria-hidden="true">&larr;</span>
                <span>Back to Landing Page</span>
              </button>
            </div>
            <HomeOverview />
          </AppShell>
        </main>
      )}
    </div>
  );
}
