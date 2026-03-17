import * as icons from "@phosphor-icons/react/dist/ssr";

export const IconControl = {
  control: "select",
  mapping: Object.fromEntries(
    Object.entries(icons).map(([iconName, Icon]) => [
      iconName,
      () => <Icon key={iconName} weights={new Map()} />,
    ]),
  ),
  options: Object.keys(icons),
} as const;
