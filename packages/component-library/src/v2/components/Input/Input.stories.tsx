import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Input, type InputSize } from "./Input";
import { Text } from "../Text";

const InputStory: Meta<typeof Input>["render"] = (args) => {
  const [emailValue, setEmailValue] = useState("user@example.com");
  const [passwordValue, setPasswordValue] = useState("");
  const [searchValue, setSearchValue] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Input
        {...args}
        value={emailValue}
        onChange={(event) => {
          setEmailValue(event.target.value);
          args.onChange?.(event);
        }}
      />
      <Input
        label="Password"
        type="password"
        value={passwordValue}
        onChange={(event) => {
          setPasswordValue(event.target.value);
        }}
      />
      <Input
        label={<Text>Search products</Text>}
        placeholder="Type to search..."
        value={searchValue}
        onChange={(event) => {
          setSearchValue(event.target.value);
        }}
      />
      <Input placeholder="Input without label" />
      <Input disabled placeholder="Disabled with placeholder" />
      <Input disabled value="Disabled value" />
    </div>
  );
};

const meta = {
  title: "V2/Input",
  component: Input,
  args: {
    label: "Email address",
    placeholder: "Enter your email",
    type: "email",
  },
  argTypes: {
    onChange: { action: "onChange" },
  },
  render: InputStory,
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

const SizeStory: StoryObj<typeof Input>["render"] = () => {
  const sizes: InputSize[] = ["xs", "sm", "md", "lg"];
  const [values, setValues] = useState<{ [key in InputSize]: string }>({
    xs: "",
    sm: "",
    md: "",
    lg: "",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div>
        <h3>Input Sizes</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {sizes.map((size) => (
            <div key={size} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ minWidth: "60px", fontSize: "0.875rem", color: "#666" }}>
                {size.toUpperCase()}
              </div>
              <Input
                size={size}
                placeholder={`Size ${size} input`}
                value={values[size]}
                onChange={(e) => setValues({ ...values, [size]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3>Input Sizes with Labels</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {sizes.map((size) => (
            <div key={size} style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
              <div style={{ minWidth: "60px", fontSize: "0.875rem", color: "#666", paddingTop: "0.25rem" }}>
                {size.toUpperCase()}
              </div>
              <Input
                size={size}
                label={`Label for ${size}`}
                placeholder={`Size ${size} with label`}
                value={values[size]}
                onChange={(e) => setValues({ ...values, [size]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const Size: Story = {
  render: SizeStory,
};
