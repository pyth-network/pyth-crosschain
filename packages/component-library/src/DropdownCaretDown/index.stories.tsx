import type { Meta, StoryObj } from "@storybook/react";

import { DropdownCaretDown as DropdownCaretDownComponent } from "./index.jsx";

const meta = {
  title: "building blocks/DropdownCaretDown",
  component: DropdownCaretDownComponent,
  argTypes: {
    width: {
      control: "text",
      description: "Width of the icon",
      table: {
        category: "Dimensions",
        defaultValue: { summary: "1em" },
      },
    },
    height: {
      control: "text",
      description: "Height of the icon",
      table: {
        category: "Dimensions",
        defaultValue: { summary: "1em" },
      },
    },
    className: {
      control: "text",
      description: "CSS class name",
      table: {
        category: "Styling",
      },
    },
    style: {
      control: "object",
      description: "Inline styles",
      table: {
        category: "Styling",
      },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "A dropdown caret icon that points downward. It inherits the current text color and scales with font size using em units.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DropdownCaretDownComponent>;
export default meta;

type Story = StoryObj<typeof DropdownCaretDownComponent>;

export const Default: Story = {};