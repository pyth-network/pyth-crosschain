import { GoogleAnalytics } from "@next/third-parties/google";
import { RootProviders } from "@pythnetwork/component-library/AppShell";
import { NuqsAdapter } from "@pythnetwork/react-hooks/nuqs-adapters-next";
import { Analytics } from "@vercel/analytics/next";
import { Banner } from "fumadocs-ui/components/banner";
import { RootProvider as FumadocsRootProvider } from "fumadocs-ui/provider/next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./global.css";

export const TABS = [
  { segment: "", children: "Home" },
  { segment: "price-feeds", children: "Price Feeds" },
  { segment: "express-relay", children: "Express Relay" },
  { segment: "entropy", children: "Entropy" },
];

export const Root = ({ children, googleAnalyticsId }: Props) => (
  <html lang="en">
    <body>
      <RootProviders providers={[NuqsAdapter]}>
        <FumadocsRootProvider
          search={{
            enabled: true,
            options: {
              api: "/api/search",
            },
          }}
        >
          <Banner
            id="pyth-core-pro-migration-2026-07-31"
            className="bg-violet-950 text-violet-100 hover:bg-violet-900"
          >
            <Link href="/price-feeds/migration" className="hover:underline">
              Pyth Core is upgrading on July 31, 2026 — see what changes →
            </Link>
          </Banner>
          {children}
        </FumadocsRootProvider>
      </RootProviders>
      {googleAnalyticsId && <GoogleAnalytics gaId={googleAnalyticsId} />}
      <Analytics />
    </body>
  </html>
);

type Props = {
  children: ReactNode;
  googleAnalyticsId?: string | undefined;
};
