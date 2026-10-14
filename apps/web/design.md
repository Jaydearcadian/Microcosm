---
name: microcosm-design-system
version: "1.0.0"
author: Jason Jude (Jaydearcadian)
specification: frontend-designer-token-v1
palette-framework: meodai-color-expert-oklch
motion-framework: lottiefiles-motion-design-v1
responsive-framework: responsive-craft-escalation
a11y-standard: wcag-aaa-inclusive
---

# Microcosm Design System: High-Tech FinTech & Iridescent Dark Tokens

> **Handoff Artifact:** Comprehensive framework-agnostic design system and token specification for Microcosm (`mcosm`), governing the marketing landing page and the in-app financial cockpit.

---

## 1. Design Philosophy & Brand Archetype

Microcosm embodies **Technical Gravitas & Autonomous Financial Coordination**:
- **Aesthetic Archetype:** High-Tech FinTech / Arc Protocol — Deep obsidian canvas, precision 1px borders, iridescent silver-white accents, glowing cyan/violet telemetry lasers, and glassmorphic elevated surfaces.
- **Visual Metaphor:** The **Policy Shield** — every dollar moved is protected by an intent boundary and an active space envelope.
- **Motion Archetype:** **Expressive & Precise** — smooth spring curves (350–450ms) for entrance choreographies, snappy micro-interactions (150ms) for controls, and pointer-following radial border glows.

---

## 2. Design Tokens (YAML Specification)

```yaml
colors:
  canvas:
    base: "oklch(0.11 0.015 250)"        # Deep obsidian void
    subtle: "oklch(0.14 0.02 250)"      # Section alternating background
    elevated: "oklch(0.17 0.025 250)"    # Card and cockpit surfaces
    overlay: "oklch(0.20 0.03 250)"     # Modals, tooltips, popovers
    glass: "rgba(18, 22, 34, 0.72)"     # Glassmorphic backdrop blur

  border:
    subtle: "oklch(0.24 0.02 250)"      # Base structural dividers
    default: "oklch(0.30 0.03 250)"     # Component and card borders
    hover: "oklch(0.45 0.05 250)"       # Interactive hover state
    glow: "oklch(0.92 0.02 250 / 0.4)"  # Iridescent highlight glow

  text:
    primary: "oklch(0.98 0.005 250)"    # High-contrast headings and values
    secondary: "oklch(0.78 0.02 250)"   # Paragraphs, secondary labels
    muted: "oklch(0.55 0.02 250)"       # Meta labels, inactive nav, placeholders
    inverse: "oklch(0.10 0.01 250)"     # Contrast button text

  accent:
    # Iridescent Silver / White with Arc Cyan Glow
    silver: "oklch(0.96 0.01 250)"
    cyan: "oklch(0.76 0.17 215)"        # Arc gas and telemetry cyan
    violet: "oklch(0.70 0.19 295)"      # Policy approval glow
    electric: "oklch(0.82 0.15 230)"    # Active intent highlight

  semantic:
    success: "oklch(0.74 0.20 148)"     # Confirmed payments, approved policies
    warning: "oklch(0.78 0.16 75)"      # Approaching velocity caps
    error: "oklch(0.65 0.22 25)"        # Policy violations, rejected intents
    info: "oklch(0.72 0.15 235)"        # Telemetry notes, network indicator

typography:
  family:
    display: "Space Grotesk, Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    body: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    mono: "JetBrains Mono, Fira Code, ui-monospace, monospace"
  scale:
    display: "clamp(2.75rem, 1.8rem + 4.5cqi, 4.5rem)"
    h1: "clamp(2.25rem, 1.5rem + 3.2cqi, 3.25rem)"
    h2: "clamp(1.75rem, 1.25rem + 2.2cqi, 2.5rem)"
    h3: "clamp(1.25rem, 1rem + 1.2cqi, 1.75rem)"
    body: "clamp(0.9375rem, 0.85rem + 0.4cqi, 1.0625rem)"
    small: "clamp(0.8125rem, 0.75rem + 0.2cqi, 0.875rem)"
    mono: "clamp(0.8125rem, 0.75rem + 0.2cqi, 0.875rem)"

spacing:
  scale:
    xs: "0.25rem"   # 4px
    sm: "0.5rem"    # 8px
    md: "1rem"      # 16px
    lg: "1.5rem"    # 24px
    xl: "2rem"      # 32px
    2xl: "3rem"     # 48px
    3xl: "4.5rem"   # 72px

radius:
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "24px"
  pill: "9999px"

shadows:
  glow-cyan: "0 0 35px -5px oklch(0.76 0.17 215 / 0.25)"
  glow-iridescent: "0 0 45px -10px oklch(0.96 0.01 250 / 0.18), 0 0 25px -5px oklch(0.76 0.17 215 / 0.20)"
  card: "0 4px 20px -2px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
  cockpit: "0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px oklch(0.30 0.03 250)"

motion:
  timing:
    fast: "150ms"
    medium: "280ms"
    expressive: "450ms"
  easing:
    spring: "cubic-bezier(0.16, 1, 0.3, 1)"
    smooth: "cubic-bezier(0.4, 0, 0.2, 1)"
    snappy: "cubic-bezier(0.2, 0, 0, 1)"
```

---

## 3. Responsive Escalation & Topology (`responsive-craft`)

Following the 3-layer responsive craft hierarchy:
1. **Continuous Fluidity:** Typographic scales, section paddings, and card gaps scale with `clamp()` and container queries.
2. **Component Containment (`@container`):**
   - The **Hero Cockpit** stacks vertically on mobile viewports (< 640px) with touch-friendly sliders, and seamlessly expands into a dual-pane asymmetric telemetry station on desktop (≥ 1024px).
   - Envelope policy cards adapt from stacked metrics to multi-column visual timelines depending on container width.
3. **Structural Media Queries:**
   - **Header:** Sticky floating pill with `backdrop-filter: blur(16px)` on desktop; responsive slide-out drawer on mobile.
   - **Touch Targets:** Strictly `min-height: 48px` and `min-width: 48px` across all interactive buttons and inputs.

---

## 4. Motion Choreography & Interactions (`motion-design-skill`)

- **Hero Entrance:** Staggered sequence (0ms: Navigation pill fade-in → 100ms: Hero headline & badges → 250ms: Cockpit terminal boot sequence → 400ms: Telemetry sparklines).
- **Pointer-Follow Glow:** Cards track cursor movement in real time via CSS variables `--mouse-x` and `--mouse-y` rendering an iridescent radial highlight on the 1px border.
- **Accessibility:** Full `prefers-reduced-motion: reduce` fallback where all translational animations (`translateY`) collapse to instant opacity state transitions.

---

## 5. In-App Financial Architecture & Continuity

- **Landing Page (`/`):** Welcoming narrative, live interactive policy simulator, Arc network telemetry, developer SDK examples, and prominent **"Launch App"** action.
- **In-App Home & Money (`/money`, `/receive`, `/people`, `/activity`):** Inherits the exact same high-tech obsidian design tokens, providing zero context shock when transitioning from landing page to authenticated transactions.
- **Envelopes UI (`features/envelopes`):** Visual policy vault cards displaying real-time daily burn rate (`spentToday / maxAmountPerDay`), schedule radar, and allowlisted agents.
- **Agents UI (`features/agents`):** Dedicated registration view for autonomous AI agents, generating cryptographic intent authorization tokens bounded by active Space envelopes.
