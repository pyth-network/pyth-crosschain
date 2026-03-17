import type { Meta, StoryObj } from "@storybook/react";
import buttonMeta from "../Button/index.stories.jsx";
import { Select as SelectComponent } from "./index.jsx";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { children, beforeIcon, ...argTypes } = buttonMeta.argTypes;
const meta = {
  argTypes: {
    ...argTypes,
    buttonLabel: {
      control: "text",
      table: {
        category: "Label",
      },
    },
    defaultSelectedKey: {
      table: {
        disable: true,
      },
    },
    hideLabel: {
      control: "boolean",
      table: {
        category: "Label",
      },
    },
    icon: beforeIcon,
    label: {
      control: "text",
      table: {
        category: "Label",
      },
    },
    onSelectionChange: {
      table: {
        category: "Behavior",
      },
    },
    optionGroups: {
      table: {
        disable: true,
      },
    },
    options: {
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
    show: {
      table: {
        disable: true,
      },
    },
  },
  component: SelectComponent,
} satisfies Meta<typeof SelectComponent>;
export default meta;

export const Flat = {
  args: {
    buttonLabel: "",
    defaultSelectedKey: "foo",
    hideLabel: true,
    hideText: false,
    isDisabled: false,
    isPending: false,
    label: "A SELECT!",
    options: ["foo", "bar", "baz"].map((id) => ({ id })),
    rounded: false,
    show: (value) => `The option ${value.id.toString()}`,
    size: "md",
    variant: "primary",
  },
} satisfies StoryObj<typeof SelectComponent>;

export const Grouped = {
  args: {
    buttonLabel: "",
    defaultSelectedKey: "foo1",
    hideGroupLabel: true,
    hideLabel: true,
    hideText: false,
    isDisabled: false,
    isPending: false,
    label: "FOOS AND BARS",
    optionGroups: [
      { name: "All", options: ["foo1", "foo2", "Some"].map((id) => ({ id })) },
      { name: "bars", options: ["bar1", "bar2", "bar3"].map((id) => ({ id })) },
      {
        name: "bazzes",
        options: ["baz1", "baz2", "baz3"].map((id) => ({ id })),
      },
    ],
    rounded: false,
    show: (value) => `The option ${value.id.toString()}`,
    size: "md",
    variant: "primary",
  },
  argTypes: {
    hideGroupLabel: {
      control: "boolean",
      table: {
        category: "Contents",
      },
    },
  },
} satisfies StoryObj<typeof SelectComponent>;
