import "@pythnetwork/component-library/resetV2";
import "@pythnetwork/component-library/themeV2";

import "../pyth-app.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  description:
    "A single place to view Pyth data feeds and pricing information, as well as managing your Pyth Pro subscription and API keys",
  title: "Pyth App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="root">{children}</body>
    </html>
  );
}
