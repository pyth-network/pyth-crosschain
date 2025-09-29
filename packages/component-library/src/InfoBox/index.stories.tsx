import * as icons from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { InfoBox as InfoBoxComponent } from "./index.jsx";

const iconControl = {
  control: "select",
  options: Object.keys(icons),
  mapping: Object.fromEntries(
    Object.entries(icons).map(([iconName, Icon]) => [
      iconName,
      <Icon key={iconName} weights={new Map()} />,
    ]),
  ),
  description: "The icon of the info box.",
  table: {
    category: "Appearance",
  },
} as const;

const meta = {
  component: InfoBoxComponent,
  argTypes: {
    header: {
      control: "text",
      table: {
        category: "Content",
      },
    },
    children: {
      control: "text",
      table: {
        category: "Content",
      },
    },
    variant: {
      control: "select",
      options: ["neutral", "info", "warning", "error", "data", "success"],
      description: "The variant of the info box.",
      table: {
        category: "Appearance",
      },
    },
    icon: iconControl,
  },
} satisfies Meta<typeof InfoBoxComponent>;
export default meta;

export const InfoBox = {
  args: {
    children: "This is a default info box with some content.",
  },
} satisfies StoryObj<typeof InfoBoxComponent>;
