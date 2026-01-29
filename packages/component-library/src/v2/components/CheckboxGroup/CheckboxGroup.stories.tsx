import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { CheckboxGroup } from "./CheckboxGroup";

const options = [
  { key: "alerts", label: "Alerts", value: "alerts" },
  { key: "announcements", label: "Announcements", value: "announcements" },
  { key: "product", label: "Product updates", value: "product" },
  { key: "research", label: "Research", value: "research" },
];

const meta = {
  title: "V2/CheckboxGroup",
  component: CheckboxGroup,
  args: {
    label: "Notifications",
    onChange: () => {},
    options,
    value: ["alerts", "product"],
  },
  argTypes: {
    onChange: { action: "onChange" },
    options: { control: false },
    value: { control: false },
  },
  render: (args) => {
    const [value, setValue] = useState<string[]>(["alerts", "product"]);

    return (
      <CheckboxGroup
        {...args}
        options={options}
        value={value}
        onChange={(nextValue) => {
          setValue(nextValue);
          args.onChange?.(nextValue);
        }}
      />
    );
  },
} satisfies Meta<typeof CheckboxGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onChange: () => {},
    options,
    value: ["alerts", "product"],
  },
};
