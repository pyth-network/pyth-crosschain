import type { Meta, StoryObj } from "@storybook/react";

import { BenTestComponent } from "./index.jsx";

const meta = {
  component: BenTestComponent,
} satisfies Meta<typeof BenTestComponent>;

export default meta;

export const BenTest = {} satisfies StoryObj<typeof BenTestComponent>;
