import { GoogleAnalytics } from "@next/third-parties/google";
import { RootProviders } from "@pythnetwork/component-library/AppShell";
import { NuqsAdapter } from "@pythnetwork/react-hooks/nuqs-adapters-next";
import { Analytics } from "@vercel/analytics/next";
import { RootProvider as FumadocsRootProvider } from "fumadocs-ui/provider/next";
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
    <head>
      <link
        rel="alternate"
        type="text/plain"
        title="llms.txt — documentation index for AI agents"
        href="/llms.txt"
      />
    </head>
    <body>
      <a
        href="/llms.txt"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        For AI agents: see /llms.txt for the documentation index. Any page can
        be fetched as markdown by appending .mdx to its URL, or by sending an
        Accept: text/markdown header.
      </a>
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
