"use client";

import React from "react";

const EXTERNAL_LINKS = [
  {
    href: "https://github.com/Jaydearcadian/Microcosm",
    label: "GitHub"
  },
  {
    href: "https://testnet.arcscan.app/tx/0xb9ff68b720ccc128a8791435979dd08b50ea16d189df212a0e4a256b321be408",
    label: "ArcScan Settlement Proof"
  },
  {
    href: "https://dorahacks.io/hackathon/arc-microgrants",
    label: "Arc Microgrants"
  }
];

const STATUS_LINKS = [
  { href: "/health", label: "Health API" },
  { href: "/readiness", label: "Readiness API" }
];

export function LandingFooter() {
  return (
    <footer className="border-t border-ink/10 bg-canvas px-4 py-14">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-8 md:flex-row">
        <div className="flex flex-col items-center gap-2 md:items-start">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-arc to-ray">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" aria-hidden="true">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </span>
            <span className="font-display text-base font-bold text-ink">Microcosm</span>
          </div>
          <p className="max-w-sm text-center text-xs leading-relaxed text-ink-tertiary md:text-left">
            Arc-native programmable payments and policy guardrails for autonomous agents and
            organizations.
          </p>
        </div>

        <nav aria-label="Protocol resources" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-medium text-ink-secondary">
          {EXTERNAL_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[48px] items-center gap-1.5 transition-colors duration-250 ease-[var(--ease-spring)] hover:text-arc"
            >
              <span>{link.label}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ))}

          {STATUS_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[48px] items-center transition-colors duration-250 ease-[var(--ease-spring)] hover:text-arc"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="mx-auto mt-8 flex max-w-[1280px] flex-col items-center justify-between gap-3 border-t border-ink/10 pt-6 font-mono text-[11px] text-ink-tertiary sm:flex-row">
        <p>© 2026 Microcosm. Built for Arc Mainnet (Chain 5042).</p>
        <p>Non-custodial settlement rail powered by Arc USDC (0x3600...0000).</p>
      </div>
    </footer>
  );
}
