import { GoogleAnalytics } from "@next/third-parties/google";
import { RootProviders } from "@pythnetwork/component-library/AppShell";
import { NuqsAdapter } from "@pythnetwork/react-hooks/nuqs-adapters-next";
import { Analytics } from "@vercel/analytics/next";
import { RootProvider as FumadocsRootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

import "./global.css";

export const TABS = [
  { children: "Home", segment: "" },
  { children: "Price Feeds", segment: "price-feeds" },
  { children: "Express Relay", segment: "express-relay" },
  { children: "Entropy", segment: "entropy" },
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
