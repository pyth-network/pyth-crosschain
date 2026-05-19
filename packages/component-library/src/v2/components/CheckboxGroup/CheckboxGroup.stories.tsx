import { NOOP } from "@pythnetwork/shared-lib/constants";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { CheckboxGroup } from "./CheckboxGroup";

const options = [
  { key: "alerts", label: "Alerts", value: "alerts" },
  { key: "announcements", label: "Announcements", value: "announcements" },
  { key: "product", label: "Product updates", value: "product" },
  { key: "research", label: "Research", value: "research" },
];

const CheckboxGroupStory: Meta<typeof CheckboxGroup>["render"] = (args) => {
  const [value, setValue] = useState<string[]>(["alerts", "product"]);

  return (
    <CheckboxGroup
      {...args}
      onChange={(nextValue) => {
        setValue(nextValue);
        args.onChange(nextValue);
      }}
      options={options}
      value={value}
    />
  );
};

const meta = {
  args: {
    label: "Notifications",
    onChange: NOOP,
    options,
    value: ["alerts", "product"],
  },
  argTypes: {
    onChange: { action: "onChange" },
    options: { control: false },
    value: { control: false },
  },
  component: CheckboxGroup,
  render: CheckboxGroupStory,
  title: "V2/CheckboxGroup",
} satisfies Meta<typeof CheckboxGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    options,
    value: ["alerts", "product"],
  },
};
