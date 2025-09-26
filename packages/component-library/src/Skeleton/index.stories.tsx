import type { Meta, StoryObj } from "@storybook/react";

import { Skeleton as SkeletonComponent } from "./index.jsx";

const meta = {
  component: SkeletonComponent,
  argTypes: {
    label: {
      control: "text",
      table: {
        category: "Skeleton",
      },
    },
    width: {
      control: "number",
      table: {
        category: "Skeleton",
      },
    },
    fill: {
      control: "boolean",
      table: {
        category: "Skeleton",
      },
    },
  },
} satisfies Meta<typeof SkeletonComponent>;
export default meta;

export const Skeleton = {
  args: {
    label: "Loading",
    width: 20,
  },
} satisfies StoryObj<typeof SkeletonComponent>;

export const SkeletonFill: StoryObj<typeof SkeletonComponent> = {
  render: (args) => (
    <div style={{ width: "100vw" }}>
      <SkeletonComponent {...args} />
    </div>
  ),
  args: {
    label: "Loading",
    fill: true,
  },
};
