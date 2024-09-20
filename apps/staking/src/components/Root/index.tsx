import { GoogleAnalytics } from "@next/third-parties/google";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import clsx from "clsx";
import { Red_Hat_Text, Red_Hat_Mono } from "next/font/google";
import type { ReactNode, CSSProperties } from "react";

import {
  IS_PRODUCTION_SERVER,
  GOOGLE_ANALYTICS_ID,
  AMPLITUDE_API_KEY,
  WALLETCONNECT_PROJECT_ID,
  RPC,
  HERMES_URL,
  IS_MAINNET,
} from "../../config/server";
import { ApiProvider } from "../../hooks/use-api";
import { LoggerProvider } from "../../hooks/use-logger";
import { Amplitude } from "../Amplitude";
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
  <RouterProvider>
    <LoggerProvider>
      <WalletProvider
        walletConnectProjectId={WALLETCONNECT_PROJECT_ID}
        rpc={RPC}
        network={
          IS_MAINNET
            ? WalletAdapterNetwork.Mainnet
            : WalletAdapterNetwork.Devnet
        }
      >
        <ApiProvider hermesUrl={HERMES_URL}>
          <html
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
            <body className="grid min-h-dvh grid-rows-[auto_1fr_auto] text-pythpurple-100 [background:radial-gradient(20rem_50rem_at_50rem_10rem,_rgba(119,_49,_234,_0.20)_0%,_rgba(17,_15,_35,_0.00)_100rem),_#0A0814] selection:bg-pythpurple-600/60">
              <Header className="z-10" />
              <MaxWidth className="z-0 min-h-[calc(100dvh_-_var(--header-height))] py-8 sm:min-h-0">
                {children}
              </MaxWidth>
              <Footer className="z-10" />
            </body>
            {GOOGLE_ANALYTICS_ID && (
              <GoogleAnalytics gaId={GOOGLE_ANALYTICS_ID} />
            )}
            {AMPLITUDE_API_KEY && <Amplitude apiKey={AMPLITUDE_API_KEY} />}
            {!IS_PRODUCTION_SERVER && <ReportAccessibility />}
          </html>
        </ApiProvider>
      </WalletProvider>
    </LoggerProvider>
  </RouterProvider>
);
