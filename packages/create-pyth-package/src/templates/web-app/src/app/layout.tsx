import { AppShell } from "@pythnetwork/component-library/AppShell";
import { NuqsAdapter } from "@pythnetwork/react-hooks/nuqs-adapters-next";
import type { Metadata } from "next";
import "./globals.scss";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "{{packageNameWithoutOrg}}",
  description: "{{description}}",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <AppShell
      appName="{{packageNameWithoutOrg}}"
      enableAccessibilityReporting
      providers={[NuqsAdapter]}
    >
      {children}
    </AppShell>
  );
}
