"use client";

import React from "react";

interface LandingNavProps {
  onLaunchApp: () => void;
  isAuthenticated?: boolean;
}

const NAV_LINKS = [
  { href: "#simulator", label: "Policy Simulator" },
  { href: "#primitives", label: "Primitives" },
  { href: "#agents", label: "AI Agents" },
  { href: "#telemetry", label: "Arc Telemetry" }
];

/**
 * LandingNav - floating frosted pill navigation (handoff section 3.1).
 *
 *  - Sticky floating pill, max-width 1040px, backdrop-filter blur(24px).
 *  - Accessibility: <nav aria-label> landmark, 48px touch targets, visible
 *    Arc Cyan focus ring with 3px offset (WCAG 2.2 / handoff section 6).
 *  - The telemetry badge is an aria-live region so screen readers announce
 *    chain-state changes rather than silently mutating.
 */
export function LandingNav({ onLaunchApp, isAuthenticated }: LandingNavProps) {
  return (
    <header className="sticky top-4 z-50 mx-auto w-full max-w-[1040px] px-4">
      <nav
        aria-label="Main navigation"
        className="glass-pill flex items-center justify-between gap-4 px-4 py-2.5 shadow-[var(--shadow-cockpit)] sm:px-5 sm:py-3"
      >
        {/* Brand mark */}
        <a
          href="#hero-heading"
          className="flex min-h-[48px] shrink-0 items-center gap-2.5 rounded-lg px-1 transition-opacity duration-300 ease-[var(--ease-spring)] hover:opacity-85"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-arc to-ray shadow-[var(--shadow-glow-cyan)]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </span>
          <span className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-ink">
            Microcosm
            <span className="rounded-full border border-arc/40 bg-arc-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-arc">
              v0.1 Arc
            </span>
          </span>
        </a>

        {/* Anchor links - desktop only, mobile uses the in-page scroll */}
        <ul className="hidden items-center gap-6 text-sm font-medium text-ink-secondary md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="inline-flex min-h-[48px] items-center transition-colors duration-250 ease-[var(--ease-spring)] hover:text-arc"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Live network badge + primary CTA */}
        <div className="flex items-center gap-2 sm:gap-3">
          <p
            aria-live="polite"
            className="hidden items-center gap-2 rounded-full border border-ink/10 bg-canvas/80 px-2.5 py-1 font-mono text-xs text-ink-secondary sm:flex"
          >
            <span className="pulse-indicator" aria-hidden="true" />
            <span>Arc 5042</span>
          </p>

          <button
            type="button"
            onClick={onLaunchApp}
            className="inline-flex min-h-[48px] items-center gap-1.5 rounded-full bg-ink px-4 text-xs font-semibold text-ink-inverse shadow-[var(--shadow-glow-cyan)] transition-all duration-300 ease-[var(--ease-spring)] hover:bg-arc-hover active:scale-95 sm:px-5 sm:text-sm"
          >
            {isAuthenticated ? "Go to Dashboard" : "Launch App"}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </nav>
    </header>
  );
}
