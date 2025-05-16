"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import clsx from "clsx";
import dynamic from "next/dynamic";
import type { ComponentProps, ReactNode } from "react";

import { Amplitude } from "./amplitude.jsx";
import { BodyProviders } from "./body-providers.jsx";
import { sans } from "./fonts.js";
import { HtmlWithLang } from "./html-with-lang.jsx";
import { I18nProvider } from "./i18n-provider.jsx";
import styles from "./index.module.scss";
import { TabRoot, TabPanel } from "./tabs.jsx";
import { Footer } from "../Footer/index.jsx";
import { Header } from "../Header/index.jsx";
import { MainNavTabs } from "../MainNavTabs/index.jsx";
import { MobileNavTabs } from "../MobileNavTabs/index.jsx";
import { ComposeProviders } from "../compose-providers.jsx";
import { RouterProvider } from "./router-provider.jsx";
import { LoggerProvider } from "../useLogger/index.jsx";

import "./base.scss";

const ReportAccessibility = dynamic(() =>
  import("./report-accessibility.js").then((mod) => mod.ReportAccessibility),
);

type Tab = ComponentProps<typeof MainNavTabs>["tabs"][number] & {
  children: ReactNode;
};

type Props = AppBodyProps & {
  enableAccessibilityReporting: boolean;
  amplitudeApiKey?: string | undefined;
  googleAnalyticsId?: string | undefined;
  providers?: ComponentProps<typeof ComposeProviders>["providers"] | undefined;
};

export const AppShell = ({
  enableAccessibilityReporting,
  amplitudeApiKey,
  googleAnalyticsId,
  providers,
  ...props
}: Props) => (
  <RootProviders providers={providers}>
    <HtmlWithLang
      // See https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
      suppressHydrationWarning
      className={clsx(sans.className, styles.html)}
    >
      <body className={styles.body}>
        <AppBody {...props} />
      </body>
      {googleAnalyticsId && <GoogleAnalytics gaId={googleAnalyticsId} />}
      {amplitudeApiKey && <Amplitude apiKey={amplitudeApiKey} />}
      {enableAccessibilityReporting && <ReportAccessibility />}
    </HtmlWithLang>
  </RootProviders>
);

type AppBodyProps = Pick<
  ComponentProps<typeof Header>,
  "appName" | "mainCta" | "extraCta"
> & {
  tabs?: Tab[] | undefined;
  children: ReactNode;
};

export const AppBody = ({ tabs, children, ...props }: AppBodyProps) => (
  <BodyProviders>
    <TabRoot className={styles.appShell ?? ""}>
      <Header
        className={styles.header}
        mainMenu={
          tabs && (
            <MainNavTabs className={styles.mainNavTabs ?? ""} tabs={tabs} />
          )
        }
        {...props}
      />
      <main className={styles.main}>
        <TabPanel>{children}</TabPanel>
      </main>
      <Footer className={styles.footer} />
      {tabs && <MobileNavTabs tabs={tabs} className={styles.mobileNavTabs} />}
    </TabRoot>
  </BodyProviders>
);

type RootProvidersProps = Omit<
  ComponentProps<typeof ComposeProviders>,
  "providers"
> & {
  providers?: ComponentProps<typeof ComposeProviders>["providers"] | undefined;
};

export const RootProviders = ({ providers, ...props }: RootProvidersProps) => (
  <ComposeProviders
    providers={[
      ...(providers ?? []),
      LoggerProvider,
      I18nProvider,
      RouterProvider,
    ]}
    {...props}
  />
);
