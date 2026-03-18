import type { Meta, StoryObj } from "@storybook/react";

import { Skeleton as SkeletonComponent } from "./index.jsx";

const meta = {
  argTypes: {
    fill: {
      control: "boolean",
      table: {
        category: "Skeleton",
      },
    },
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
  },
  component: SkeletonComponent,
} satisfies Meta<typeof SkeletonComponent>;
export default meta;

export const Skeleton = {
  args: {
    fill: false,
    label: "Loading",
    width: 20,
  },
  render: (args) => (
    <div style={{ display: "flex", justifyContent: "center", width: "100vw" }}>
      <SkeletonComponent {...args} />
    </div>
  ),
} satisfies StoryObj<typeof SkeletonComponent>;
