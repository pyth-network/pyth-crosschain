import * as icons from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";
import { SIZES } from "../Button/index.jsx";
import { SearchButton as SearchButtonComponent } from "./index.jsx";

const iconControl = {
  control: "select",
  mapping: Object.fromEntries(
    Object.entries(icons).map(([iconName, Icon]) => [
      iconName,
      <Icon key={iconName} weights={new Map()} />,
    ]),
  ),
  options: Object.keys(icons),
} as const;

const meta = {
  argTypes: {
    beforeIcon: {
      ...iconControl,
      table: {
        category: "Contents",
      },
    },
    size: {
      control: "inline-radio",
      options: SIZES,
      table: {
        category: "Variant",
      },
    },
  },
  component: SearchButtonComponent,
} satisfies Meta<typeof SearchButtonComponent>;
export default meta;

export const SearchButton = {
  args: {
    largeScreenContent: "Search",
    size: "sm",
    smallScreenContent: "Search",
  },
} satisfies StoryObj<typeof SearchButtonComponent>;
