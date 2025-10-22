import { RootProviders } from "@pythnetwork/component-library/AppShell";
import { RootProvider as FumadocsRootProvider } from "fumadocs-ui/provider";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

import "./global.css";

export const TABS = [
  { segment: "", children: "Home" },
  { segment: "price-feeds", children: "Price Feeds" },
  { segment: "express-relay", children: "Express Relay" },
  { segment: "entropy", children: "Entropy" },
];

type Props = {
  children: ReactNode;
};

export const Root = ({ children }: Props) => (
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
          {/* commenting out the app body because we don't have the app shell anymore
          <AppBody
        appName="Developer Hub"
        displaySupportButton={false}
        extraCta={<SearchButton />}
        mainCta={{
          label: "Developer Forum",
          href: "https://dev-forum.pyth.network/",
        }}
        tabs={TABS}
      > */}
          {children}
          {/* </AppBody> */}
        </FumadocsRootProvider>
      </RootProviders>
    </body>
  </html>
);
