import type { Meta, StoryObj } from "@storybook/react";
import cardMeta, { Card as CardStory } from "../Card/index.stories.jsx";
import { StatCard as StatCardComponent } from "./index.jsx";

const cardMetaArgTypes = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { title, toolbar, icon, footer, ...argTypes } = cardMeta.argTypes;
  return argTypes;
};

const meta = {
  argTypes: {
    ...cardMetaArgTypes(),
    corner: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    header: {
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
    stat: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
  },
  component: StatCardComponent,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof StatCardComponent>;
export default meta;

const cardStoryArgs = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { title, toolbar, footer, ...args } = CardStory.args;
  return args;
};

export const StatCard = {
  args: {
    ...cardStoryArgs(),
    corner: ":)",
    header: "Active Feeds",
    miniStat: "+5",
    stat: "552",
  },
} satisfies StoryObj<typeof StatCardComponent>;
