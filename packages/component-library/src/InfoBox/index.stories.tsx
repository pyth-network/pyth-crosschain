import * as icons from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { InfoBox as InfoBoxComponent } from "./index.jsx";

const iconControl = {
  control: "select",
  description: "The icon of the info box.",
  mapping: Object.fromEntries(
    Object.entries(icons).map(([iconName, Icon]) => [
      iconName,
      <Icon key={iconName} weights={new Map()} />,
    ]),
  ),
  options: Object.keys(icons),
  table: {
    category: "Appearance",
  },
} as const;

const meta = {
  argTypes: {
    children: {
      control: "text",
      table: {
        category: "Content",
      },
    },
    header: {
      control: "text",
      table: {
        category: "Content",
      },
    },
    icon: iconControl,
    variant: {
      control: "select",
      description: "The variant of the info box.",
      options: ["neutral", "info", "warning", "error", "data", "success"],
      table: {
        category: "Appearance",
      },
    },
  },
  component: InfoBoxComponent,
} satisfies Meta<typeof InfoBoxComponent>;
export default meta;

export const InfoBox = {
  args: {
    children: "This is a default info box with some content.",
  },
} satisfies StoryObj<typeof InfoBoxComponent>;
