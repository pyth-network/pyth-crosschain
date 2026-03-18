import { AppShell } from "@pythnetwork/component-library/AppShell";
import { NuqsAdapter } from "@pythnetwork/react-hooks/nuqs-adapters-next";
import type { ReactNode } from "react";

import {
  AMPLITUDE_API_KEY,
  ENABLE_ACCESSIBILITY_REPORTING,
  GOOGLE_ANALYTICS_ID,
} from "../../config/server";

type Props = {
  children: ReactNode;
};

export const Root = ({ children }: Props) => (
  <AppShell
    amplitudeApiKey={AMPLITUDE_API_KEY}
    appName="Entropy Explorer"
    enableAccessibilityReporting={ENABLE_ACCESSIBILITY_REPORTING}
    googleAnalyticsId={GOOGLE_ANALYTICS_ID}
    mainCta={{
      href: "https://docs.pyth.network/entropy",
      label: "Entropy Docs",
    }}
    providers={[NuqsAdapter]}
  >
    {children}
  </AppShell>
);
