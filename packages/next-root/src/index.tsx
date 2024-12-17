import { GoogleAnalytics } from "@next/third-parties/google";
import { LoggerProvider } from "@pythnetwork/app-logger/provider";
import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";
import type { ComponentProps, ReactNode } from "react";

import { Amplitude } from "./amplitude";
import { ComposeProviders } from "./compose-providers";
import { HtmlWithLang } from "./html-with-lang";
import { I18nProvider } from "./i18n-provider";
import { RouterProvider } from "./router-provider";

const ReportAccessibility = dynamic(() =>
  import("./report-accessibility.js").then((mod) => mod.ReportAccessibility),
);

type Props = Omit<ComponentProps<typeof HtmlWithLang>, "children"> & {
  children: ReactNode;
  enableAccessibilityReporting: boolean;
  amplitudeApiKey?: string | undefined;
  googleAnalyticsId?: string | undefined;
  providers?: ComponentProps<typeof ComposeProviders>["providers"] | undefined;
  bodyClassName?: string | undefined;
};

export const Root = ({
  children,
  providers,
  amplitudeApiKey,
  googleAnalyticsId,
  enableAccessibilityReporting,
  bodyClassName,
  ...props
}: Props) => (
  <ComposeProviders
    providers={[
      ...(providers ?? []),
      LoggerProvider,
      I18nProvider,
      RouterProvider,
    ]}
  >
    <HtmlWithLang
      // See https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
      suppressHydrationWarning
      {...props}
    >
      <body className={bodyClassName}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
      {googleAnalyticsId && <GoogleAnalytics gaId={googleAnalyticsId} />}
      {amplitudeApiKey && <Amplitude apiKey={amplitudeApiKey} />}
      {enableAccessibilityReporting && <ReportAccessibility />}
    </HtmlWithLang>
  </ComposeProviders>
);
