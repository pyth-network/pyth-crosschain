import { GoogleAnalytics } from "@next/third-parties/google";
import clsx from "clsx";
import { Red_Hat_Text, Red_Hat_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import {
  IS_PRODUCTION_SERVER,
  GOOGLE_ANALYTICS_ID,
  AMPLITUDE_API_KEY,
  WALLETCONNECT_PROJECT_ID,
} from "../../server-config";
import { PriceFeedListProvider } from "../../use-price-feed-list";
import { Amplitude } from "../Amplitude";
import { HighlighterProvider } from "../Code/use-highlighted-code";
import { EvmProvider } from "../EvmProvider";
import { Footer } from "../Footer";
import { Header } from "../Header";
import { ReportAccessibility } from "../ReportAccessibility";

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
  <html
    lang="en"
    dir="ltr"
    className={clsx("h-dvh", redHatText.variable, redHatMono.variable)}
    // See https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
    suppressHydrationWarning
  >
    <body className="grid size-full grid-cols-1 grid-rows-[max-content_1fr_max-content] bg-white text-pythpurple-950 dark:bg-pythpurple-900 dark:text-white">
      <ThemeProvider attribute="class">
        <HighlighterProvider>
          <PriceFeedListProvider>
            <EvmProvider walletConnectProjectId={WALLETCONNECT_PROJECT_ID}>
              <Header className="z-10 border-b border-neutral-400 dark:border-neutral-600" />
              <div className="size-full">{children}</div>
              <Footer className="z-10 border-t border-neutral-400 dark:border-neutral-600" />
            </EvmProvider>
          </PriceFeedListProvider>
        </HighlighterProvider>
      </ThemeProvider>
    </body>
    {GOOGLE_ANALYTICS_ID && <GoogleAnalytics gaId={GOOGLE_ANALYTICS_ID} />}
    {AMPLITUDE_API_KEY && <Amplitude apiKey={AMPLITUDE_API_KEY} />}
    {!IS_PRODUCTION_SERVER && <ReportAccessibility />}
  </html>
);
