import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "@rainbow-me/rainbowkit/styles.css";
import "@/styles/globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import { Providers } from "./providers";

const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Vyuh: Agents trade. Vyuh holds.", template: "%s · Vyuh" },
  description:
    "Onchain guardrails for AI trading agents on HashKey Chain. Seven policy rings decide every trade. Try to break them in the Arena.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f2a" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme is set before hydration by the boot script, so React must not complain about it.
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <Providers>
          <SiteHeader />
          <main id="main">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
