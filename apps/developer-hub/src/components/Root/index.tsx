import { AppShell } from "@pythnetwork/component-library/AppShell";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

import {
  ENABLE_ACCESSIBILITY_REPORTING,
  GOOGLE_ANALYTICS_ID,
  AMPLITUDE_API_KEY,
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
    {children}
  </AppShell>
);
