import { GoogleAnalytics } from "@next/third-parties/google";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import clsx from "clsx";
import { Red_Hat_Text, Red_Hat_Mono } from "next/font/google";
import type { ReactNode } from "react";

import {
  IS_PRODUCTION_SERVER,
  GOOGLE_ANALYTICS_ID,
  AMPLITUDE_API_KEY,
  WALLETCONNECT_PROJECT_ID,
  RPC,
  IS_MAINNET,
} from "../../config/server";
import { LoggerProvider } from "../../hooks/use-logger";
import { StakeAccountProvider } from "../../hooks/use-stake-account";
import { Amplitude } from "../Amplitude";
import { Footer } from "../Footer";
import { Header } from "../Header";
import { MaxWidth } from "../MaxWidth";
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
      rpc={RPC}
      network={
        IS_MAINNET ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet
      }
    >
      <StakeAccountProvider>
        <html
          lang="en"
          dir="ltr"
          className={clsx(redHatText.variable, redHatMono.variable)}
        >
          <body className="grid min-h-dvh grid-rows-[auto_1fr_auto] text-pythpurple-100 [background:radial-gradient(113.49%_134.57%_at_5.57%_97.67%,_rgba(17,_15,_35,_0.00)_0%,_rgba(119,_49,_234,_0.20)_100%),_#0A0814] selection:bg-pythpurple-600/60">
            <Header className="z-10" />
            <MaxWidth className="my-4">{children}</MaxWidth>
            <Footer className="z-10" />
          </body>
          {GOOGLE_ANALYTICS_ID && (
            <GoogleAnalytics gaId={GOOGLE_ANALYTICS_ID} />
          )}
          {AMPLITUDE_API_KEY && <Amplitude apiKey={AMPLITUDE_API_KEY} />}
          {!IS_PRODUCTION_SERVER && <ReportAccessibility />}
        </html>
      </StakeAccountProvider>
    </WalletProvider>
  </LoggerProvider>
);
