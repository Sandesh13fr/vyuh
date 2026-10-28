"use client";

import { RainbowKitProvider, lightTheme, type Theme } from "@rainbow-me/rainbowkit";
import * as Tooltip from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { ToastProvider } from "@/components/Toast";
import { DEFAULT_CHAIN, wagmiConfig } from "@/lib/wagmi";

// RainbowKit injects these as CSS variables, so token references follow light/dark automatically.
const base = lightTheme({ accentColor: "var(--vy-ring)", accentColorForeground: "var(--vy-on-ring)", borderRadius: "medium" });
const theme: Theme = {
  ...base,
  colors: {
    ...base.colors,
    modalBackground: "var(--vy-surface)",
    modalBorder: "var(--vy-line)",
    modalText: "var(--vy-ink)",
    modalTextSecondary: "var(--vy-ink-2)",
    modalTextDim: "var(--vy-ink-2)",
    generalBorder: "var(--vy-line)",
    connectButtonBackground: "var(--vy-surface)",
    connectButtonInnerBackground: "var(--vy-surface-2)",
    connectButtonText: "var(--vy-ink)",
    profileForeground: "var(--vy-surface)",
    actionButtonSecondaryBackground: "var(--vy-surface-2)",
    closeButton: "var(--vy-ink-2)",
    closeButtonBackground: "var(--vy-surface-2)",
    menuItemBackground: "var(--vy-surface-2)",
    error: "var(--vy-blocked)",
  },
  fonts: { body: "var(--vy-font)" },
  shadows: { ...base.shadows, connectButton: "none", dialog: "var(--vy-shadow-1)" },
};

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} modalSize="compact" initialChain={DEFAULT_CHAIN}>
          <Tooltip.Provider delayDuration={200}>
            <ToastProvider>{children}</ToastProvider>
          </Tooltip.Provider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
