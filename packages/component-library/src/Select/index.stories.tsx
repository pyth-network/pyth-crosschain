import type { Meta, StoryObj } from "@storybook/react";

import { Select as SelectComponent } from "./index.js";
import buttonMeta from "../Button/index.stories.js";

const OPTIONS = ["foo", "bar", "baz"];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { children, beforeIcon, onPress, ...argTypes } = buttonMeta.argTypes;
const meta = {
  component: SelectComponent,
  argTypes: {
    ...argTypes,
    icon: beforeIcon,
    label: {
      control: "text",
      table: {
        category: "Label",
      },
    },
    hideLabel: {
      control: "boolean",
      table: {
        category: "Label",
      },
    },
    options: {
      table: {
        disable: true,
      },
    },
    defaultSelectedKey: {
      table: {
        disable: true,
      },
    },
    show: {
      table: {
        disable: true,
      },
    },
    placement: {
      control: "select",
      options: [
        "bottom",
        "bottom left",
        "bottom right",
        "bottom start",
        "bottom end",
        "top",
        "top left",
        "top right",
        "top start",
        "top end",
        "left",
        "left top",
        "left bottom",
        "start",
        "start top",
        "start bottom",
        "right",
        "right top",
        "right bottom",
        "end",
        "end top",
        "end bottom",
      ],
      table: {
        category: "Popover",
      },
    },
    onSelectionChange: {
      table: {
        category: "Behavior",
      },
    },
  },
} satisfies Meta<typeof SelectComponent>;
export default meta;

export const Select = {
  args: {
    defaultSelectedKey: "foo",
    options: OPTIONS,
    variant: "primary",
    size: "md",
    isDisabled: false,
    isPending: false,
    rounded: false,
    hideText: false,
    show: (value) => `The option ${value.toString()}`,
    label: "A Select!",
    hideLabel: true,
  },
} satisfies StoryObj<typeof SelectComponent>;
