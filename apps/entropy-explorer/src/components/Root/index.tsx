import { AppShell } from "@pythnetwork/component-library/AppShell";
import { NuqsAdapter } from "@pythnetwork/react-hooks/nuqs-adapters-next";
import type { ReactNode } from "react";

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
    providers={[NuqsAdapter]}
  >
    {children}
  </AppShell>
);
