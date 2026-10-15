import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "../components/providers";

/* Architectural typography per docs/design-handoff.md §1.
   Self-hosted by next/font at build time — zero layout shift, no runtime
   request to Google Fonts, and the CSS variable names map 1:1 onto the
   --font-display / --font-sans / --font-mono theme tokens in globals.css. */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap"
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Microcosm — Programmable money for the open internet",
  description:
    "Arc-native programmable payments. Spaces and Programmable Envelopes give autonomous AI agents policy-bounded authority to spend USDC on Arc without holding master private keys.",
  metadataBase: new URL("https://microcosmonarc.vercel.app"),
  openGraph: {
    title: "Microcosm — Programmable money for the open internet",
    description:
      "Intent-bound financial coordination on Arc Mainnet. Non-custodial, policy-gated USDC settlement for autonomous agents.",
    url: "https://microcosmonarc.vercel.app",
    siteName: "Microcosm",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Microcosm — Programmable money for the open internet",
    description:
      "Intent-bound financial coordination on Arc Mainnet. Non-custodial, policy-gated USDC settlement for autonomous agents."
  }
};

export const viewport: Viewport = {
  themeColor: "#0b0d14",
  colorScheme: "dark",
  width: "device-width",
  // `viewport-fit=cover` is required for env(safe-area-inset-*) on notched
  // devices (responsive-craft pitfall #7).
  initialScale: 1
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

