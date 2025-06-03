import type { Meta, StoryObj } from "@storybook/react";

import { CopyButton as CopyButtonComponent } from "./index.jsx";

const meta = {
  component: CopyButtonComponent,
  argTypes: {
    text: {
      control: "text",
      description: "The text to copy to clipboard",
      table: {
        category: "Content",
      },
    },
    iconOnly: {
      control: "boolean",
      description: "Show only the copy icon without text",
      table: {
        category: "Display",
      },
    },
    children: {
      control: "text",
      description: "Custom button text (defaults to 'Copy')",
      table: {
        category: "Content",
      },
    },
    isDisabled: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CopyButtonComponent>;
export default meta;

export const Default = {
  args: {
    text: "This text will be copied to clipboard",
  },
} satisfies StoryObj<typeof CopyButtonComponent>;

export const IconOnly = {
  args: {
    text: "Icon only copy button",
    iconOnly: true,
  },
} satisfies StoryObj<typeof CopyButtonComponent>;

export const CodeSnippet = {
  args: {
    text: "npm install @pythnetwork/component-library",
    children: "Copy Command",
  },
} satisfies StoryObj<typeof CopyButtonComponent>;

export const Disabled = {
  args: {
    text: "This cannot be copied",
    isDisabled: true,
  },
} satisfies StoryObj<typeof CopyButtonComponent>;
