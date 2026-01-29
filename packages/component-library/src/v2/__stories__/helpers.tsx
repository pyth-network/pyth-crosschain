import * as icons from "@phosphor-icons/react/dist/ssr";

export const IconControl = {
  control: "select",
  options: Object.keys(icons),
  mapping: Object.fromEntries(
    Object.entries(icons).map(([iconName, Icon]) => [
      iconName,
      () => <Icon key={iconName} weights={new Map()} />,
    ]),
  ),
} as const;
