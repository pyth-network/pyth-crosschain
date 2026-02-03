import { Moon, Sun } from "@phosphor-icons/react/dist/ssr";

import type { SwitchProps } from "./Switch";
import { Switch } from "./Switch";

export function ThemeSwitch(
  props: Omit<SwitchProps, "children" | "offIcon" | "onIcon" | "variant">,
) {
  return <Switch {...props} offIcon={Moon} onIcon={Sun} variant="icon" />;
}
