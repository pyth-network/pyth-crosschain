import type { Meta, StoryObj } from "@storybook/react";

import { Breadcrumbs as BreadcrumbsComponent } from "./index.jsx";

const meta = {
  argTypes: {
    items: {
      table: {
        disable: true,
      },
    },
    label: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
  },
  component: BreadcrumbsComponent,
} satisfies Meta<typeof BreadcrumbsComponent>;
export default meta;

export const Breadcrumbs = {
  args: {
    items: [
      { href: "/", label: "Home" },
      { href: "/foo", label: "Foo" },
      { label: "Bar" },
    ],
    label: "Breadcrumbs",
  },
} satisfies StoryObj<typeof BreadcrumbsComponent>;
