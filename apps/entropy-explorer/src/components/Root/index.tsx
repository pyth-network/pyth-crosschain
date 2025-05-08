import { AppShell } from "@pythnetwork/component-library/AppShell";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

import { EvmProvider } from "./evm-provider";
import {
  ENABLE_ACCESSIBILITY_REPORTING,
  GOOGLE_ANALYTICS_ID,
  AMPLITUDE_API_KEY,
} from "../../config/server";

type Props = {
  children: ReactNode;
};

export const Root = ({ children }: Props) => (
  <AppShell
    appName="Entropy Explorer"
    amplitudeApiKey={AMPLITUDE_API_KEY}
    googleAnalyticsId={GOOGLE_ANALYTICS_ID}
    enableAccessibilityReporting={ENABLE_ACCESSIBILITY_REPORTING}
    mainCta={{
      label: "Entropy Docs",
      href: "https://docs.pyth.network/entropy",
    }}
    providers={[EvmProvider, NuqsAdapter]}
  >
    {children}
  </AppShell>
);
