import type { Meta, StoryObj } from "@storybook/react";

import { Select as SelectComponent } from "./index.jsx";
import buttonMeta from "../Button/index.stories.jsx";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { children, beforeIcon, ...argTypes } = buttonMeta.argTypes;
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
    optionGroups: {
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
    buttonLabel: {
      control: "text",
      table: {
        category: "Label",
      },
    },
  },
} satisfies Meta<typeof SelectComponent>;
export default meta;

export const Flat = {
  args: {
    defaultSelectedKey: "foo",
    options: ["foo", "bar", "baz"].map((id) => ({ id })),
    variant: "primary",
    size: "md",
    isDisabled: false,
    isPending: false,
    rounded: false,
    hideText: false,
    show: (value) => `The option ${value.id.toString()}`,
    label: "A SELECT!",
    hideLabel: true,
    buttonLabel: "",
  },
} satisfies StoryObj<typeof SelectComponent>;

export const Grouped = {
  argTypes: {
    hideGroupLabel: {
      control: "boolean",
      table: {
        category: "Contents",
      },
    },
  },
  args: {
    defaultSelectedKey: "foo1",
    optionGroups: [
      { name: "All", options: ["foo1", "foo2", "Some"].map((id) => ({ id })) },
      { name: "bars", options: ["bar1", "bar2", "bar3"].map((id) => ({ id })) },
      {
        name: "bazzes",
        options: ["baz1", "baz2", "baz3"].map((id) => ({ id })),
      },
    ],
    variant: "primary",
    size: "md",
    isDisabled: false,
    isPending: false,
    rounded: false,
    hideText: false,
    show: (value) => `The option ${value.id.toString()}`,
    label: "FOOS AND BARS",
    hideLabel: true,
    hideGroupLabel: true,
    buttonLabel: "",
  },
} satisfies StoryObj<typeof SelectComponent>;
