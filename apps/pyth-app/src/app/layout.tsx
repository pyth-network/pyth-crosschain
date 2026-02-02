import "@pythnetwork/component-library/themeV2";
import "../pyth-app.css";

// eslint is extremely confused for some reason

import { Spinner } from "@pythnetwork/component-library/v2";
import { NuqsAdapter } from "@pythnetwork/react-hooks/nuqs-adapters-next";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Suspense } from "react";

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
      <html lang="en" suppressHydrationWarning>
        {/* https://base-ui.com/react/overview/quick-start#portals */}
        <body className="root">
          {/* Suspense wrapper is needed because nuqs is used internally */}
          <Suspense fallback={<Spinner>Loading Pyth App...</Spinner>}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableColorScheme
              enableSystem
            >
              <PythAppLayout>{children}</PythAppLayout>
            </ThemeProvider>
          </Suspense>
        </body>
      </html>
    </NuqsAdapter>
  );
}
