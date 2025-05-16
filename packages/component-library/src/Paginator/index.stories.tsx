import type { Meta, StoryObj } from "@storybook/react";

import { Paginator as PaginatorComponent } from "./index.jsx";

const meta = {
  component: PaginatorComponent,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    currentPage: {
      control: "number",
      table: {
        category: "Page",
      },
    },
    numPages: {
      control: "number",
      table: {
        category: "Page",
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
    mkPageLink: {
      table: {
        disable: true,
      },
    },
    className: {
      table: {
        disable: true,
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
