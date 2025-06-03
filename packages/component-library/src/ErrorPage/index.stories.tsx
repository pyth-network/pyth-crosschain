import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { ErrorPage as ErrorPageComponent } from "./index.jsx";

const meta = {
  title: "layouts & pages/ErrorPage",
  component: ErrorPageComponent,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    error: {
      description: "The error object to display",
      table: {
        category: "Props",
      },
    },
    reset: {
      description: "Optional reset function",
      table: {
        category: "Props",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ErrorPageComponent>;
export default meta;

type Story = StoryObj<typeof ErrorPageComponent>;

export const Default: Story = {
  args: {
    error: new Error("Something went wrong while loading the data"),
  },
};

export const WithReset: Story = {
  args: {
    error: new Error("Failed to fetch user profile"),
    reset: fn(),
  },
};

export const WithDigest: Story = {
  args: {
    error: Object.assign(new Error("Internal server error"), {
      digest: "ERR_500_INTERNAL",
    }),
    reset: fn(),
  },
};

export const NetworkError: Story = {
  args: {
    error: new Error("NetworkError: Failed to fetch"),
    reset: fn(),
  },
};

export const ValidationError: Story = {
  args: {
    error: Object.assign(new Error("Validation failed"), {
      digest: "VALIDATION_ERROR_422",
    }),
  },
};

export const LongErrorMessage: Story = {
  args: {
    error: new Error(
      "Failed to process the request due to an unexpected error in the authentication module. Please check your credentials and try again. If the problem persists, contact support.",
    ),
    reset: fn(),
  },
};