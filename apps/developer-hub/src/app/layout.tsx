import type { ReactNode } from "react";

import { Root } from "../components/Root";
import { GOOGLE_ANALYTICS_ID } from "../config/server";

export { metadata, viewport } from "../lib/metadata";

import "katex/dist/katex.css";

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <Root
      {...(GOOGLE_ANALYTICS_ID
        ? { googleAnalyticsId: GOOGLE_ANALYTICS_ID }
        : {})}
    >
      {children}
    </Root>
  );
}

type RootLayoutProps = {
  children: ReactNode;
};
