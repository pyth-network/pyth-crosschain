import { sans } from "@pythnetwork/fonts";
import { Root as BaseRoot } from "@pythnetwork/next-root";
import clsx from "clsx";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

import { Footer } from "./footer";
import { Header } from "./header";
import { MobileMenu } from "./mobile-menu";
import { TabPanel, TabRoot } from "./tabs";
import {
  IS_PRODUCTION_SERVER,
  GOOGLE_ANALYTICS_ID,
  AMPLITUDE_API_KEY,
} from "../../config/server";

type Props = {
  children: ReactNode;
};

export const Root = ({ children }: Props) => (
  <BaseRoot
    amplitudeApiKey={AMPLITUDE_API_KEY}
    googleAnalyticsId={GOOGLE_ANALYTICS_ID}
    enableAccessibilityReporting={!IS_PRODUCTION_SERVER}
    bodyClassName={clsx(
      "bg-white font-sans text-steel-900 antialiased selection:bg-violet-600 selection:text-steel-50 dark:bg-steel-950 dark:text-steel-50 dark:selection:bg-violet-400 dark:selection:text-steel-950",
      sans.variable,
    )}
    providers={[NuqsAdapter]}
  >
    <TabRoot className="grid min-h-dvh grid-rows-[auto_1fr_auto]">
      <Header />
      <main className="pb-12 pt-6">
        <TabPanel>{children}</TabPanel>
      </main>
      <Footer />
      <MobileMenu />
    </TabRoot>
  </BaseRoot>
);
