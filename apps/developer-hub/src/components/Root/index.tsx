import { AppShell } from "@pythnetwork/component-library/AppShell";
import { RootProvider as FumadocsRootProvider } from "fumadocs-ui/provider";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import "./global.css";

import {
  AMPLITUDE_API_KEY,
  ENABLE_ACCESSIBILITY_REPORTING,
  GOOGLE_ANALYTICS_ID,
} from "../../config/server";

export const TABS = [
  { segment: "", children: "Home" },
  { segment: "pyth-core", children: "Pyth Core" },
  { segment: "lazer", children: "Lazer" },
  { segment: "express-relay", children: "Express Relay" },
  { segment: "entropy", children: "Entropy" },
];

type Props = {
  children: ReactNode;
};

export const Root = ({ children }: Props) => (
  <AppShell
    appName="Developer Hub"
    amplitudeApiKey={AMPLITUDE_API_KEY}
    googleAnalyticsId={GOOGLE_ANALYTICS_ID}
    enableAccessibilityReporting={ENABLE_ACCESSIBILITY_REPORTING}
    providers={[NuqsAdapter]}
    tabs={TABS}
  >
    <FumadocsRootProvider>{children}</FumadocsRootProvider>
  </AppShell>
);
