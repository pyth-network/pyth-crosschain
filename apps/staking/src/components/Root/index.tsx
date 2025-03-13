import { GoogleAnalytics } from "@next/third-parties/google";
import clsx from "clsx";
import { Red_Hat_Text, Red_Hat_Mono } from "next/font/google";
import type { ReactNode, CSSProperties, HTMLProps } from "react";

import { I18nProvider } from "./i18n-provider";
import { RestrictedRegionBanner } from "./restricted-region-banner";
import { ToastRegion } from "./toast-region";
import {
  IS_PRODUCTION_SERVER,
  GOOGLE_ANALYTICS_ID,
  AMPLITUDE_API_KEY,
  WALLETCONNECT_PROJECT_ID,
  MAINNET_RPC,
  HERMES_URL,
  PYTHNET_RPC,
  SIMULATION_PAYER_ADDRESS,
} from "../../config/server";
import { ApiProvider } from "../../hooks/use-api";
import { LoggerProvider } from "../../hooks/use-logger";
import { NetworkProvider } from "../../hooks/use-network";
import { ToastProvider } from "../../hooks/use-toast";
import { Amplitude } from "../Amplitude";
import { Changelog } from "../Changelog";
import { Footer } from "../Footer";
import { Header } from "../Header";
import { MaxWidth } from "../MaxWidth";
import { ReportAccessibility } from "../ReportAccessibility";
import { RouterProvider } from "../RouterProvider";
import { WalletProvider } from "../WalletProvider";

const redHatText = Red_Hat_Text({
  subsets: ["latin"],
  variable: "--font-sans",
});

const redHatMono = Red_Hat_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

type Props = {
  children: ReactNode;
};

export const Root = ({ children }: Props) => (
  <HtmlWithProviders
    lang="en"
    dir="ltr"
    style={
      {
        "--header-height": "4rem",
      } as CSSProperties
    }
    className={clsx(
      "scroll-pt-header-height",
      redHatText.variable,
      redHatMono.variable,
    )}
  >
    <body className="grid min-h-dvh grid-rows-[auto_auto_auto_1fr_auto] text-pythpurple-100 [background:radial-gradient(20rem_50rem_at_50rem_10rem,_rgba(119,_49,_234,_0.20)_0%,_rgba(17,_15,_35,_0.00)_100rem),_#0A0814] selection:bg-pythpurple-600/60 lg:grid-rows-[auto_auto_1fr_auto]">
      <Header className="z-10" />
      <RestrictedRegionBanner />
      <MaxWidth className="z-0 min-h-[calc(100dvh_-_var(--header-height))] py-4 sm:min-h-0">
        {children}
      </MaxWidth>
      <Footer className="z-10" />
      <ToastRegion />
      <Changelog />
    </body>
    {GOOGLE_ANALYTICS_ID && <GoogleAnalytics gaId={GOOGLE_ANALYTICS_ID} />}
    {AMPLITUDE_API_KEY && <Amplitude apiKey={AMPLITUDE_API_KEY} />}
    {!IS_PRODUCTION_SERVER && <ReportAccessibility />}
  </HtmlWithProviders>
);

const HtmlWithProviders = ({ lang, ...props }: HTMLProps<HTMLHtmlElement>) => (
  <I18nProvider>
    <RouterProvider>
      <LoggerProvider>
        <NetworkProvider>
          <WalletProvider
            walletConnectProjectId={WALLETCONNECT_PROJECT_ID}
            mainnetRpc={MAINNET_RPC}
          >
            <ApiProvider
              hermesUrl={HERMES_URL}
              pythnetRpcUrl={PYTHNET_RPC}
              simulationPayerAddress={SIMULATION_PAYER_ADDRESS}
            >
              <ToastProvider>
                <html lang={lang} {...props} />
              </ToastProvider>
            </ApiProvider>
          </WalletProvider>
        </NetworkProvider>
      </LoggerProvider>
    </RouterProvider>
  </I18nProvider>
);
