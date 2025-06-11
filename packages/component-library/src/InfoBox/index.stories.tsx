import * as icons from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { iconControl } from "../icon-control.jsx";
import { InfoBox as InfoBoxComponent, VARIANTS } from "./index.jsx";
import styles from "./index.stories.module.scss";

const meta = {
  title: "overlays & dialogs/InfoBox",
  component: InfoBoxComponent,
  argTypes: {
    variant: {
      control: "select",
      options: VARIANTS,
      description: "The visual style variant",
      table: {
        category: "Appearance",
      },
    },
    header: {
      control: "text",
      description: "Custom header text (overrides default)",
      table: {
        category: "Content",
      },
    },
    icon: {
      ...iconControl,
      description: "Custom icon (overrides default)",
      table: {
        category: "Content",
      },
    },
    children: {
      control: "text",
      description: "Content to display in the info box",
      table: {
        category: "Content",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InfoBoxComponent>;
export default meta;

type Story = StoryObj<typeof InfoBoxComponent>;

export const Default: Story = {
  args: {
    children:
      "This is an informational message to help users understand something important.",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className={styles.variantsList}>
      <InfoBoxComponent variant="neutral">
        This is a neutral message without any particular emphasis.
      </InfoBoxComponent>
      <InfoBoxComponent variant="info">
        This is an informational message providing helpful context.
      </InfoBoxComponent>
      <InfoBoxComponent variant="warning">
        This is a warning message alerting users to potential issues.
      </InfoBoxComponent>
      <InfoBoxComponent variant="error">
        This is an error message indicating something went wrong.
      </InfoBoxComponent>
      <InfoBoxComponent variant="data">
        This message relates to data or technical information.
      </InfoBoxComponent>
      <InfoBoxComponent variant="success">
        This is a success message celebrating an achievement!
      </InfoBoxComponent>
    </div>
  ),
};

export const CustomHeader: Story = {
  args: {
    variant: "info",
    header: "Did you know?",
    children: "You can customize the header text to better suit your content.",
  },
};

export const CustomIcon: Story = {
  args: {
    variant: "info",
    icon: <icons.Lightbulb />,
    header: "Pro Tip",
    children: "You can also use custom icons to enhance the message.",
  },
};

export const LongContent: Story = {
  args: {
    variant: "warning",
    children: (
      <>
        <p>This info box contains multiple paragraphs of content.</p>
        <p>
          It can handle longer messages that need more detailed explanations,
          including lists, links, and other formatted content.
        </p>
        <ul>
          <li>First important point</li>
          <li>Second important point</li>
          <li>Third important point</li>
        </ul>
      </>
    ),
  },
};

export const ErrorWithInstructions: Story = {
  args: {
    variant: "error",
    header: "Connection Failed",
    children: (
      <>
        Unable to connect to the server. Please check your internet connection
        and try again. If the problem persists, contact{" "}
        <a href="#support">support</a>.
      </>
    ),
  },
};

export const SuccessNotification: Story = {
  args: {
    variant: "success",
    header: "Payment Successful!",
    children:
      "Your transaction has been processed successfully. You should receive a confirmation email shortly.",
  },
};

export const DataExample: Story = {
  args: {
    variant: "data",
    header: "API Response",
    children: (
      <pre>
        {/* eslint-disable-next-line unicorn/no-null */}
        {JSON.stringify({ status: "ok", timestamp: 1_234_567_890 }, null, 2)}
      </pre>
    ),
  },
};
