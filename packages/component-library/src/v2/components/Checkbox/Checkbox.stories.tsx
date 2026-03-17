import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import type { InputSize } from "../../theme/theme";
import { Text } from "../Text";
import { Checkbox } from "./Checkbox";

const CheckboxStory: Meta<typeof Checkbox>["render"] = (args) => {
  const sizes: InputSize[] = ["xs", "sm", "md", "lg"];
  const [primaryCheckedBySize, setPrimaryCheckedBySize] = useState<
    Record<InputSize, boolean>
  >({
    lg: false,
    md: true,
    sm: false,
    xs: true,
  });
  const [summaryCheckedBySize, setSummaryCheckedBySize] = useState<
    Record<InputSize, boolean>
  >({
    lg: true,
    md: false,
    sm: true,
    xs: false,
  });
  const [alertsCheckedBySize, setAlertsCheckedBySize] = useState<
    Record<InputSize, boolean>
  >({
    lg: false,
    md: false,
    sm: true,
    xs: true,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {sizes.map((size) => (
        <div
          key={size}
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <Text>{size.toUpperCase()}</Text>
          <Checkbox
            {...args}
            checked={primaryCheckedBySize[size]}
            onCheckedChange={(nextChecked, event) => {
              setPrimaryCheckedBySize((prev) => ({
                ...prev,
                [size]: !!nextChecked,
              }));
              args.onCheckedChange?.(nextChecked, event);
            }}
            size={size}
          />
          <Checkbox
            checked={summaryCheckedBySize[size]}
            label="Send weekly summary"
            onCheckedChange={(nextChecked) => {
              setSummaryCheckedBySize((prev) => ({
                ...prev,
                [size]: !!nextChecked,
              }));
            }}
            size={size}
          />
          <Checkbox
            checked={alertsCheckedBySize[size]}
            label={<Text>Enable trading alerts</Text>}
            onCheckedChange={(nextChecked) => {
              setAlertsCheckedBySize((prev) => ({
                ...prev,
                [size]: !!nextChecked,
              }));
            }}
            size={size}
          />
        </div>
      ))}
    </div>
  );
};

const meta = {
  args: {
    checked: true,
    label: "Receive product updates",
  },
  argTypes: {
    onCheckedChange: { action: "onCheckedChange" },
  },
  component: Checkbox,
  render: CheckboxStory,
  title: "V2/Checkbox",
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
