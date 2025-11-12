import { AppShell } from "@pythnetwork/component-library/AppShell";
import { NuqsAdapter } from "@pythnetwork/react-hooks/nuqs-adapters-next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.scss";
import type { ReactNode } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppShell
          appName="{{packageNameWithoutOrg}}"
          enableAccessibilityReporting
          providers={[NuqsAdapter]}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
