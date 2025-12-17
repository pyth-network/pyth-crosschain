import type { Meta, StoryObj } from "@storybook/react";
import cardMeta, { Card as CardStory } from "../Card/index.stories.jsx";
import { StatCard as StatCardComponent } from "./index.jsx";

const cardMetaArgTypes = () => {
  const { title, toolbar, icon, footer, ...argTypes } = cardMeta.argTypes;
  return argTypes;
};

const meta = {
  component: StatCardComponent,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    ...cardMetaArgTypes(),
    header: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    stat: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    miniStat: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    corner: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
  },
} satisfies Meta<typeof StatCardComponent>;
export default meta;

const cardStoryArgs = () => {
  const { title, toolbar, footer, ...args } = CardStory.args;
  return args;
};

export const StatCard = {
  args: {
    ...cardStoryArgs(),
    header: "Active Feeds",
    stat: "552",
    miniStat: "+5",
    corner: ":)",
  },
} satisfies StoryObj<typeof StatCardComponent>;
