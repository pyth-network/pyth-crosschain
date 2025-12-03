import type { Meta, StoryObj } from "@storybook/react";

import { BenTestComponent as Component } from "./index";

const meta = {
  component: Component,
} satisfies Meta<typeof Component>;
export default meta;

export const BenTestComponent = {} satisfies StoryObj<typeof Component>;
