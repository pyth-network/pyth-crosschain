import "./globals.scss";

import { AppShell } from "@pythnetwork/component-library/AppShell";
import { NuqsAdapter } from "@pythnetwork/react-hooks/nuqs-adapters-next";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppContent, AppLayout, LeftPanel } from "../components";

export const metadata: Metadata = {
  title: "Pyth App",
  description:
    "Portal for managing Pyth Pro subscriptions, minting API keys, and checking your API usage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <AppShell
      appName="Pyth App"
      enableAccessibilityReporting
      providers={[NuqsAdapter]}
    >
      <AppLayout>
        <LeftPanel />
        <AppContent>{children}</AppContent>
      </AppLayout>
    </AppShell>
  );
}
