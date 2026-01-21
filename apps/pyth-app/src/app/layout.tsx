import "@pythnetwork/component-library/resetV2";
import "@pythnetwork/component-library/themeV2";

// eslint is extremely confused for some reason
// eslint-disable-next-line import/order
import { NuqsAdapter } from "@pythnetwork/react-hooks/nuqs-adapters-next";

import "../pyth-app.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PythAppLayout } from "../components/Layout";

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
    <NuqsAdapter>
      <html lang="en">
        {/* https://base-ui.com/react/overview/quick-start#portals */}
        <body className="root">
          <PythAppLayout>{children}</PythAppLayout>
        </body>
      </html>
    </NuqsAdapter>
  );
}
