import type { Meta, StoryObj } from "@storybook/react";

import { Meter as MeterComponent } from "./index.jsx";
import styles from "./index.stories.module.scss";

const meta = {
  component: MeterComponent,
  argTypes: {
    value: {
      control: { type: "range", min: 0, max: 100, step: 1 },
      description: "The current value",
      table: {
        category: "Value",
      },
    },
    minValue: {
      control: "number",
      description: "The minimum value",
      table: {
        category: "Value",
      },
    },
    maxValue: {
      control: "number",
      description: "The maximum value",
      table: {
        category: "Value",
      },
    },
    label: {
      control: "text",
      description: "Aria label for accessibility",
      table: {
        category: "Accessibility",
      },
    },
    startLabel: {
      control: "text",
      description: "Label shown at the start of the meter",
      table: {
        category: "Labels",
      },
    },
    endLabel: {
      control: "text",
      description: "Label shown at the end of the meter",
      table: {
        category: "Labels",
      },
    },
    variant: {
      control: "radio",
      options: ["default", "error"],
      description: "Visual variant of the meter",
      table: {
        category: "Appearance",
      },
    },
    labelClassName: {
      control: "text",
      description: "Class name for the label",
      table: {
        category: "Labels",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MeterComponent>;
export default meta;

type Story = StoryObj<typeof MeterComponent>;

export const Default: Story = {
  args: {
    label: "Progress",
    value: 50,
    minValue: 0,
    maxValue: 100,
  },
};

export const WithLabels: Story = {
  args: {
    label: "Storage usage",
    value: 75,
    minValue: 0,
    maxValue: 100,
    startLabel: "0 GB",
    endLabel: "100 GB",
  },
};

export const ErrorVariant: Story = {
  args: {
    label: "Critical usage",
    value: 95,
    minValue: 0,
    maxValue: 100,
    startLabel: "0%",
    endLabel: "100%",
    variant: "error",
  },
};

export const Empty: Story = {
  args: {
    label: "No progress",
    value: 0,
    minValue: 0,
    maxValue: 100,
    startLabel: "Start",
    endLabel: "End",
  },
};

export const Full: Story = {
  args: {
    label: "Complete",
    value: 100,
    minValue: 0,
    maxValue: 100,
    startLabel: "0%",
    endLabel: "100%",
  },
};

export const CustomRange: Story = {
  args: {
    label: "Temperature",
    value: 72,
    minValue: 32,
    maxValue: 100,
    startLabel: "32°F",
    endLabel: "100°F",
  },
};

export const LoadingProgress: Story = {
  args: {
    label: "Loading",
    value: 33,
    minValue: 0,
    maxValue: 100,
    startLabel: "0 MB",
    endLabel: "150 MB",
  },
};

export const BatteryLevel: Story = {
  args: {
    label: "Battery",
    value: 20,
    minValue: 0,
    maxValue: 100,
    startLabel: "Empty",
    endLabel: "Full",
    variant: "error",
  },
};

export const PerformanceScore: Story = {
  render: () => (
    <div className={styles.performanceContainer}>
      <div className={styles.performanceSection}>
        <h3>CPU Usage</h3>
        <MeterComponent
          label="CPU usage"
          value={45}
          minValue={0}
          maxValue={100}
          startLabel="0%"
          endLabel="100%"
        />
      </div>
      <div className={styles.performanceSection}>
        <h3>Memory Usage</h3>
        <MeterComponent
          label="Memory usage"
          value={78}
          minValue={0}
          maxValue={100}
          startLabel="0%"
          endLabel="100%"
          variant="error"
        />
      </div>
      <div className={styles.performanceSection}>
        <h3>Disk Usage</h3>
        <MeterComponent
          label="Disk usage"
          value={30}
          minValue={0}
          maxValue={100}
          startLabel="0%"
          endLabel="100%"
        />
      </div>
    </div>
  ),
};