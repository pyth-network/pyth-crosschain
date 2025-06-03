import type { Meta, StoryObj } from "@storybook/react";

import { Breadcrumbs as BreadcrumbsComponent } from "./index.jsx";

const meta = {
  component: BreadcrumbsComponent,
  argTypes: {
    label: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    items: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof BreadcrumbsComponent>;
export default meta;

export const Breadcrumbs = {
  args: {
    label: "Breadcrumbs",
    items: [
      { href: "/", label: "Home" },
      { href: "#", label: "Products" },
      { label: "Pyth Core" },
    ],
  },
} satisfies StoryObj<typeof BreadcrumbsComponent>;
