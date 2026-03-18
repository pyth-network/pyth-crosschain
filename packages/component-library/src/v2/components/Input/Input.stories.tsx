import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import type { InputSize } from "../../theme";
import { Text } from "../Text";
import { Input } from "./Input";

const InputStory: Meta<typeof Input>["render"] = (args) => {
  const [emailValue, setEmailValue] = useState("user@example.com");
  const [passwordValue, setPasswordValue] = useState("");
  const [searchValue, setSearchValue] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Input
        {...args}
        onChange={(event) => {
          setEmailValue(event.target.value);
          args.onChange?.(event);
        }}
        value={emailValue}
      />
      <Input
        label="Password"
        onChange={(event) => {
          setPasswordValue(event.target.value);
        }}
        type="password"
        value={passwordValue}
      />
      <Input
        label={<Text>Search products</Text>}
        onChange={(event) => {
          setSearchValue(event.target.value);
        }}
        placeholder="Type to search..."
        value={searchValue}
      />
      <Input placeholder="Input without label" />
      <Input disabled placeholder="Disabled with placeholder" />
      <Input disabled value="Disabled value" />
    </div>
  );
};

const meta = {
  args: {
    label: "Email address",
    placeholder: "Enter your email",
    type: "email",
  },
  argTypes: {
    onChange: { action: "onChange" },
  },
  component: Input,
  render: InputStory,
  title: "V2/Input",
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

const SizeStory: StoryObj<typeof Input>["render"] = () => {
  const sizes: InputSize[] = ["xs", "sm", "md", "lg"];
  const [values, setValues] = useState<Record<InputSize, string>>({
    lg: "",
    md: "",
    sm: "",
    xs: "",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div>
        <h3>Input Sizes</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {sizes.map((size) => (
            <div
              key={size}
              style={{ alignItems: "center", display: "flex", gap: "1rem" }}
            >
              <div
                style={{
                  color: "#666",
                  fontSize: "0.875rem",
                  minWidth: "60px",
                }}
              >
                {size.toUpperCase()}
              </div>
              <Input
                onChange={(e) => {
                  setValues({ ...values, [size]: e.target.value });
                }}
                placeholder={`Size ${size} input`}
                size={size}
                value={values[size]}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3>Input Sizes with Labels</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {sizes.map((size) => (
            <div
              key={size}
              style={{ alignItems: "flex-start", display: "flex", gap: "1rem" }}
            >
              <div
                style={{
                  color: "#666",
                  fontSize: "0.875rem",
                  minWidth: "60px",
                  paddingTop: "0.25rem",
                }}
              >
                {size.toUpperCase()}
              </div>
              <Input
                label={`Label for ${size}`}
                onChange={(e) => {
                  setValues({ ...values, [size]: e.target.value });
                }}
                placeholder={`Size ${size} with label`}
                size={size}
                value={values[size]}
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
