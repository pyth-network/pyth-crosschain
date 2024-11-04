import { GoogleAnalytics } from "@next/third-parties/google";
import { LoggerProvider } from "@pythnetwork/app-logger/provider";
import dynamic from "next/dynamic";
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
};

export const Root = ({
  children,
  providers,
  amplitudeApiKey,
  googleAnalyticsId,
  enableAccessibilityReporting,
  ...props
}: Props) => (
  <ComposeProviders
    providers={[
      LoggerProvider,
      I18nProvider,
      RouterProvider,
      ...(providers ?? []),
    ]}
  >
    <HtmlWithLang {...props}>
      {children}
      {googleAnalyticsId && <GoogleAnalytics gaId={googleAnalyticsId} />}
      {amplitudeApiKey && <Amplitude apiKey={amplitudeApiKey} />}
      {enableAccessibilityReporting && <ReportAccessibility />}
    </HtmlWithLang>
  </ComposeProviders>
);
