import { GoogleAnalytics } from "@next/third-parties/google";
import { RootProviders } from "@pythnetwork/component-library/AppShell";
import { NuqsAdapter } from "@pythnetwork/react-hooks/nuqs-adapters-next";
import { RootProvider as FumadocsRootProvider } from "fumadocs-ui/provider";
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
          {children}
        </FumadocsRootProvider>
      </RootProviders>
      {googleAnalyticsId && <GoogleAnalytics gaId={googleAnalyticsId} />}
    </body>
  </html>
);

type Props = {
  children: ReactNode;
  googleAnalyticsId?: string | undefined;
};
