import { GoogleAnalytics } from "@next/third-parties/google";
import clsx from "clsx";
import { Red_Hat_Text, Red_Hat_Mono } from "next/font/google";
import type { ReactNode } from "react";

import {
  IS_PRODUCTION_SERVER,
  GOOGLE_ANALYTICS_ID,
  AMPLITUDE_API_KEY,
  WALLETCONNECT_PROJECT_ID,
  MAINNET_RPC,
} from "../../config/server";
import { LoggerProvider } from "../../hooks/use-logger";
import { Amplitude } from "../Amplitude";
import { ReportAccessibility } from "../ReportAccessibility";
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
  <LoggerProvider>
    <WalletProvider
      walletConnectProjectId={WALLETCONNECT_PROJECT_ID}
      rpc={MAINNET_RPC}
    >
      <html
        lang="en"
        dir="ltr"
        className={clsx("h-dvh", redHatText.variable, redHatMono.variable)}
      >
        <body className="grid size-full grid-cols-1 grid-rows-[max-content_1fr_max-content] bg-white text-pythpurple-950 dark:bg-pythpurple-900 dark:text-white">
          {children}
        </body>
        {GOOGLE_ANALYTICS_ID && <GoogleAnalytics gaId={GOOGLE_ANALYTICS_ID} />}
        {AMPLITUDE_API_KEY && <Amplitude apiKey={AMPLITUDE_API_KEY} />}
        {!IS_PRODUCTION_SERVER && <ReportAccessibility />}
      </html>
    </WalletProvider>
  </LoggerProvider>
);
