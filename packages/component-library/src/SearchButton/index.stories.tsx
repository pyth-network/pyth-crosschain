import * as icons from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { SearchButton as SearchButtonComponent } from "./index.jsx";
import { SIZES } from "../Button/index.jsx";

const iconControl = {
  control: "select",
  options: Object.keys(icons),
  mapping: Object.fromEntries(
    Object.entries(icons).map(([iconName, Icon]) => [
      iconName,
      <Icon key={iconName} weights={new Map()} />,
    ]),
  ),
} as const;

const meta = {
  component: SearchButtonComponent,
  argTypes: {
    size: {
      control: "inline-radio",
      options: SIZES,
      table: {
        category: "Variant",
      },
    },
    beforeIcon: {
      ...iconControl,
      table: {
        category: "Contents",
      },
    },
  },
} satisfies Meta<typeof SearchButtonComponent>;
export default meta;

export const SearchButton = {
  args: {
    largeScreenContent: "Search",
    smallScreenContent: "Search",
    size: "sm",
  },
} satisfies StoryObj<typeof SearchButtonComponent>;
