import Script from "next/script";
import type { ReactNode } from "react";

import { Root } from "../components/Root";
import { GOOGLE_ANALYTICS_ID } from "../config/server";

export { metadata, viewport } from "../lib/metadata";

import "katex/dist/katex.css";

export default function RootLayout({ children }: RootLayoutProps) {
  return <Root afterBodyContent={renderGoogleAnalytics()}>{children}</Root>;
}

function renderGoogleAnalytics(): ReactNode | undefined {
  if (!GOOGLE_ANALYTICS_ID) return undefined;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics-init" strategy="afterInteractive">
        {`
          if (!window.dataLayer) window.dataLayer = [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GOOGLE_ANALYTICS_ID}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}

type RootLayoutProps = {
  children: ReactNode;
};
