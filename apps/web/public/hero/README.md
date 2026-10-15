# Hero Image Slot

The hero visual is rendered by
`apps/web/features/landing/HeroMedia.tsx` from the constant `HERO_SRC`.

## Current state

The intended source artwork was not present in this environment when the page
was built (no image file existed anywhere on disk — see the handoff notes), so an
on-brand placeholder was generated to the same specification and rasterized from
a single vector source:

| File | Purpose |
|------|---------|
| `microcosm-hero.svg` | Vector source of truth (1920×1200 viewBox) |
| `hero-640.png` / `hero-960.png` / `hero-1280.png` / `hero-1920.png` | Responsive raster widths |
| `hero-{640,960,1280,1920}.avif` | AVIF variants (~8× smaller than PNG) |
| `hero-{640,960,1280,1920}.webp` | WebP variants |

## Swapping in the real artwork

1. Drop the replacement file into this directory, e.g.
   `microcosm-hero.png` (or `.avif` / `.webp` / `.jpg` / `.svg`).
2. Point `HERO_SRC` in `HeroMedia.tsx` at it:

   ```ts
   const HERO_SRC = "/hero/microcosm-hero.png" as const;
   ```

3. Rebuild. Nothing else changes — the frame, frosted scrim, `sizes` attribute,
   LCP `priority` preload, and 16:10 `aspect-ratio` are already wired, so
   Cumulative Layout Shift stays at 0.000 regardless of the new file's
   intrinsic dimensions (`object-fit: cover` absorbs aspect differences).

## Recommended source spec

- **Aspect ratio:** 16:10 (the frame's `aspect-ratio`). Wider sources crop
  gracefully; taller sources lose the top/bottom.
- **Width:** ≥1920px for crisp 2× rendering on large displays.
- **Format:** AVIF first, then WebP, PNG fallback. The component serves all
  three; browsers negotiate via the `<Image>` `srcset`.
- **Focal point:** keep the policy-shield subject near the vertical centre —
  `object-position: center 40%` biases slightly high so the shield sits above
  the caption strip.
- **Contrast:** the frame applies a bottom-up scrim, so text overlaid at the
  base keeps ≥7:1. Avoid bright detail in the lower third if you add captions.

## Regenerating the rasters from the SVG

```bash
rsvg-convert -w 1920 -h 1200 microcosm-hero.svg -o /tmp/hero-raw.png
# then use sharp to emit each width/format (see the build notes in the handoff)
```
