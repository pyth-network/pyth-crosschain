import type { Meta, StoryObj } from "@storybook/react";

import { StatCard as StatCardComponent } from "./index.jsx";
import cardMeta, { Card as CardStory } from "../Card/index.stories.jsx";

const cardMetaArgTypes = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
