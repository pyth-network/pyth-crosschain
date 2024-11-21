import { Root as BaseRoot } from "@pythnetwork/next-root";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

import { Footer } from "./footer";
import { Header } from "./header";
// import { MobileMenu } from "./mobile-menu";
import styles from "./index.module.scss";
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
    providers={[NuqsAdapter]}
  >
    <TabRoot className={styles.tabRoot ?? ""}>
      <Header className={styles.header} />
      <main className={styles.main}>
        <TabPanel>{children}</TabPanel>
      </main>
      <Footer />
    </TabRoot>
  </BaseRoot>
);
