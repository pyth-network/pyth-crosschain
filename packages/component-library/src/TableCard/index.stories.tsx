import * as Icon from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { TableCard as TableCardComponent } from "./index.js";
import tableMeta, { Table as TableStory } from "../Table/index.stories.js";

const meta = {
  component: TableCardComponent,
  parameters: {
    backgrounds: {
      disable: true,
    },
  },
  argTypes: {
    ...tableMeta.argTypes,
    title: {
      control: "text",
      table: {
        category: "Card",
      },
    },
    toolbar: {
      table: {
        disable: true,
      },
    },
    footer: {
      table: {
        disable: true,
      },
    },
    icon: {
      control: "select",
      options: Object.keys(Icon),
      mapping: Icon,
      table: {
        category: "Contents",
      },
    },
  },
} satisfies Meta<typeof TableCardComponent>;
export default meta;

export const TableCard = {
  args: {
    ...TableStory.args,
    title: "A Table",
    toolbar: <div>A toolbar</div>,
    footer: <div>A footer</div>,
  },
} satisfies StoryObj<typeof TableCardComponent>;
