import { InfoBox, VARIANTS } from "@pythnetwork/component-library/InfoBox";
import type { ComponentProps, ReactNode } from "react";

import { Case } from "../Case";

type Props = ComponentProps<"div"> & {
  icon?: ReactNode;
  header?: ReactNode;
  variant?: (typeof VARIANTS)[number] | undefined;
};

const DEFAULT_ICONS: Record<(typeof VARIANTS)[number], string> = {
  neutral: "⦿",
  info: "💡",
  warning: "⚠️",
  error: "❗",
  data: "💾",
  success: "🎉",
};

export const Callout = ({
  icon,
  header,
  variant = "info",
  children,
  ...rest
}: Props) => {
  return (
    <InfoBox
      icon={icon ?? DEFAULT_ICONS[variant]}
      header={header ?? <Case variant="APA Title Case">{variant}</Case>}
      variant={variant}
      {...rest}
    >
      {children}
    </InfoBox>
  );
};
