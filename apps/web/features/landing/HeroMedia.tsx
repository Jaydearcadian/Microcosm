"use client";

import React, { useState } from "react";
import Image from "next/image";

/**
 * HeroMedia — hosts the dropped hero image inside the architectural cockpit frame.
 *
 * Design contract (docs/design-handoff.md §3.2 + §7):
 *  - `aspect-ratio` (16/10) reserves space before decode, so CLS stays at 0.000
 *    even on a slow connection (design.md Rule 13 — never the padding hack).
 *  - AVIF is offered first (best compression), WebP second, PNG as the universal
 *    fallback. Next's <Image> picks the first format the browser advertises.
 *  - `priority` disables lazy-loading and injects a preload link, because this is
 *    the LCP element of the landing page.
 *  - A frosted scrim guarantees overlaid copy keeps >= 7:1 contrast regardless of
 *    the source artwork (WCAG AAA, handoff §6).
 *
 * SWAPPING THE HERO: drop the replacement file at
 *   apps/web/public/hero/microcosm-hero.png  (or .avif/.webp/.svg)
 * and update HERO_SRC below. Nothing else needs to change — the frame, scrim,
 * responsive sizes and LCP priority are already wired.
 */

const HERO_SRC = "/hero/hero-1920.png" as const;

const HERO_ALT =
  "Microcosm policy shield guarding an Arc settlement envelope: concentric telemetry rings surround an envelope glyph and verification check, flanked by a velocity-cap rail and an intent-bound recipient allowlist.";

export function HeroMedia() {
  const [loaded, setLoaded] = useState(false);

  return (
    <figure className="relative m-0 w-full">
      <div
        className={`hero-media arc-sheen relative w-full transition-opacity duration-500 ease-[var(--ease-spring)] ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      >
        <Image
          src={HERO_SRC}
          alt={HERO_ALT}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 92vw, 1180px"
          priority
          onLoad={() => setLoaded(true)}
          className="object-cover object-[center_40%]"
        />

        {/* Frosted glass scrim — preserves AAA contrast for overlaid copy */}
        <div className="hero-media-scrim" aria-hidden="true" />

        {/* Top hairline iridescent edge (elevation tier 1) */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-arc to-transparent opacity-80"
          aria-hidden="true"
        />

        <figcaption className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-x-3 gap-y-1.5 p-4 sm:p-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-canvas/80 px-3 py-1 font-mono text-[11px] font-semibold tracking-wide text-success backdrop-blur-md">
            <span className="arc-pulse h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            POLICY SHIELD ACTIVE
          </span>
          <span className="font-mono text-[11px] text-ink-secondary backdrop-blur-md">
            envelope env_daily_ops · velocity 25% · window open
          </span>
        </figcaption>
      </div>
    </figure>
  );
}
