import { sans } from "@pythnetwork/fonts";
import { Root as BaseRoot } from "@pythnetwork/next-root";
import clsx from "clsx";
import type { ReactNode } from "react";

import {
  IS_PRODUCTION_SERVER,
  GOOGLE_ANALYTICS_ID,
  AMPLITUDE_API_KEY,
} from "../../config/server";

type Props = {
  children: ReactNode;
};

export const Root = ({ children }: Props) => (
  <BaseRoot
    amplitudeApiKey={AMPLITUDE_API_KEY}
    googleAnalyticsId={GOOGLE_ANALYTICS_ID}
    enableAccessibilityReporting={!IS_PRODUCTION_SERVER}
  >
    <body
      className={clsx(
        "bg-white font-sans text-steel-900 antialiased dark:bg-steel-900 dark:text-steel-50",
        sans.variable,
      )}
    >
      {children}
    </body>
  </BaseRoot>
);
