import type { Meta, StoryObj } from "@storybook/react";

import { Paginator as PaginatorComponent } from "./index.jsx";

const meta = {
  argTypes: {
    className: {
      table: {
        disable: true,
      },
    },
    currentPage: {
      control: "number",
      table: {
        category: "Page",
      },
    },
    mkPageLink: {
      table: {
        disable: true,
      },
    },
    numPages: {
      control: "number",
      table: {
        category: "Page",
      },
    },
    onPageChange: {
      table: {
        category: "Behavior",
      },
    },
    onPageSizeChange: {
      table: {
        category: "Behavior",
      },
    },
    pageSize: {
      control: "number",
      table: {
        category: "Page",
      },
    },
    pageSizeOptions: {
      table: {
        disable: true,
      },
    },
  },
  component: PaginatorComponent,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PaginatorComponent>;
export default meta;

export const Paginator = {
  args: {
    currentPage: 4,
    numPages: 8,
    pageSize: 20,
    pageSizeOptions: [10, 20, 30, 40, 50],
  },
} satisfies StoryObj<typeof PaginatorComponent>;
