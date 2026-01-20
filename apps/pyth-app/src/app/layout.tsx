import "../pyth-app.css";

import { AppShell } from "@pythnetwork/component-library/AppShell";
import { NuqsAdapter } from "@pythnetwork/react-hooks/nuqs-adapters-next";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "pyth-app",
  description:
    "A single place to view Pyth data feeds and pricing information, as well as managing your Pyth Pro subscription and API keys",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <AppShell
      appName="pyth-app"
      enableAccessibilityReporting
      providers={[NuqsAdapter]}
    >
      {children}
    </AppShell>
  );
}
