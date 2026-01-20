import type { ComponentProps } from "react";

import LogoIcon from "../Header/logo.svg";

export type LogoProps = ComponentProps<typeof LogoIcon>;

export function Logo(props: LogoProps) {
  return <LogoIcon {...props} />;
}
