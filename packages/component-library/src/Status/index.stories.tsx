import type { Meta, StoryObj } from "@storybook/react";

import {
  Status as StatusComponent,
  VARIANTS,
  SIZES,
  STYLES,
} from "./index.jsx";
import styles from "./index.stories.module.scss";

const meta = {
  component: StatusComponent,
  argTypes: {
    children: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    variant: {
      control: "inline-radio",
      options: VARIANTS,
      table: {
        category: "Variant",
      },
    },
    style: {
      control: "inline-radio",
      options: STYLES,
      table: {
        category: "Variant",
      },
    },
    size: {
      control: "inline-radio",
      options: SIZES,
      table: {
        category: "Variant",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof StatusComponent>;
export default meta;

type Story = StoryObj<typeof StatusComponent>;

export const Default: Story = {
  args: {
    children: "Status",
    variant: "neutral",
    style: "filled",
    size: "md",
  },
};

// Individual variant examples
export const Neutral: Story = {
  args: {
    children: "Neutral",
    variant: "neutral",
    style: "filled",
    size: "md",
  },
};

export const Info: Story = {
  args: {
    children: "Info",
    variant: "info",
    style: "filled",
    size: "md",
  },
};

export const Warning: Story = {
  args: {
    children: "Warning",
    variant: "warning",
    style: "filled",
    size: "md",
  },
};

export const Error: Story = {
  args: {
    children: "Error",
    variant: "error",
    style: "filled",
    size: "md",
  },
};

export const Data: Story = {
  args: {
    children: "Data",
    variant: "data",
    style: "filled",
    size: "md",
  },
};

export const Success: Story = {
  args: {
    children: "Success",
    variant: "success",
    style: "filled",
    size: "md",
  },
};

export const Disabled: Story = {
  args: {
    children: "Disabled",
    variant: "disabled",
    style: "filled",
    size: "md",
  },
};

// All combinations grid
export const AllCombinations: Story = {
  render: () => (
    <div className={styles.combinationsGrid}>
      {STYLES.map((style) => (
        <div key={style} className={styles.styleSection}>
          <h3 className={styles.sectionTitle}>{style.charAt(0).toUpperCase() + style.slice(1)} Style</h3>
          {SIZES.map((size) => (
            <div key={`${style}-${size}`} className={styles.sizeSection}>
              <h4 className={styles.sizeTitle}>Size: {size.toUpperCase()}</h4>
              <div className={styles.variantsRow}>
                {VARIANTS.map((variant) => (
                  <StatusComponent
                    key={`${style}-${size}-${variant}`}
                    variant={variant}
                    style={style}
                    size={size}
                  >
                    {variant.charAt(0).toUpperCase() + variant.slice(1)}
                  </StatusComponent>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
};

// Grouped by variant
export const NeutralAllStyles: Story = {
  render: () => (
    <div className={styles.grid}>
      <StatusComponent variant="neutral" style="filled" size="xs">Neutral Filled XS</StatusComponent>
      <StatusComponent variant="neutral" style="filled" size="md">Neutral Filled MD</StatusComponent>
      <StatusComponent variant="neutral" style="outline" size="xs">Neutral Outline XS</StatusComponent>
      <StatusComponent variant="neutral" style="outline" size="md">Neutral Outline MD</StatusComponent>
    </div>
  ),
};

export const InfoAllStyles: Story = {
  render: () => (
    <div className={styles.grid}>
      <StatusComponent variant="info" style="filled" size="xs">Info Filled XS</StatusComponent>
      <StatusComponent variant="info" style="filled" size="md">Info Filled MD</StatusComponent>
      <StatusComponent variant="info" style="outline" size="xs">Info Outline XS</StatusComponent>
      <StatusComponent variant="info" style="outline" size="md">Info Outline MD</StatusComponent>
    </div>
  ),
};

export const WarningAllStyles: Story = {
  render: () => (
    <div className={styles.grid}>
      <StatusComponent variant="warning" style="filled" size="xs">Warning Filled XS</StatusComponent>
      <StatusComponent variant="warning" style="filled" size="md">Warning Filled MD</StatusComponent>
      <StatusComponent variant="warning" style="outline" size="xs">Warning Outline XS</StatusComponent>
      <StatusComponent variant="warning" style="outline" size="md">Warning Outline MD</StatusComponent>
    </div>
  ),
};

export const ErrorAllStyles: Story = {
  render: () => (
    <div className={styles.grid}>
      <StatusComponent variant="error" style="filled" size="xs">Error Filled XS</StatusComponent>
      <StatusComponent variant="error" style="filled" size="md">Error Filled MD</StatusComponent>
      <StatusComponent variant="error" style="outline" size="xs">Error Outline XS</StatusComponent>
      <StatusComponent variant="error" style="outline" size="md">Error Outline MD</StatusComponent>
    </div>
  ),
};

export const DataAllStyles: Story = {
  render: () => (
    <div className={styles.grid}>
      <StatusComponent variant="data" style="filled" size="xs">Data Filled XS</StatusComponent>
      <StatusComponent variant="data" style="filled" size="md">Data Filled MD</StatusComponent>
      <StatusComponent variant="data" style="outline" size="xs">Data Outline XS</StatusComponent>
      <StatusComponent variant="data" style="outline" size="md">Data Outline MD</StatusComponent>
    </div>
  ),
};

export const SuccessAllStyles: Story = {
  render: () => (
    <div className={styles.grid}>
      <StatusComponent variant="success" style="filled" size="xs">Success Filled XS</StatusComponent>
      <StatusComponent variant="success" style="filled" size="md">Success Filled MD</StatusComponent>
      <StatusComponent variant="success" style="outline" size="xs">Success Outline XS</StatusComponent>
      <StatusComponent variant="success" style="outline" size="md">Success Outline MD</StatusComponent>
    </div>
  ),
};

export const DisabledAllStyles: Story = {
  render: () => (
    <div className={styles.grid}>
      <StatusComponent variant="disabled" style="filled" size="xs">Disabled Filled XS</StatusComponent>
      <StatusComponent variant="disabled" style="filled" size="md">Disabled Filled MD</StatusComponent>
      <StatusComponent variant="disabled" style="outline" size="xs">Disabled Outline XS</StatusComponent>
      <StatusComponent variant="disabled" style="outline" size="md">Disabled Outline MD</StatusComponent>
    </div>
  ),
};

// Grouped by style
export const AllFilledVariants: Story = {
  render: () => (
    <div className={styles.variantGrid}>
      <div className={styles.sizeColumn}>
        <h4>XS Size</h4>
        {VARIANTS.map((variant) => (
          <StatusComponent key={variant} variant={variant} style="filled" size="xs">
            {variant}
          </StatusComponent>
        ))}
      </div>
      <div className={styles.sizeColumn}>
        <h4>MD Size</h4>
        {VARIANTS.map((variant) => (
          <StatusComponent key={variant} variant={variant} style="filled" size="md">
            {variant}
          </StatusComponent>
        ))}
      </div>
    </div>
  ),
};

export const AllOutlineVariants: Story = {
  render: () => (
    <div className={styles.variantGrid}>
      <div className={styles.sizeColumn}>
        <h4>XS Size</h4>
        {VARIANTS.map((variant) => (
          <StatusComponent key={variant} variant={variant} style="outline" size="xs">
            {variant}
          </StatusComponent>
        ))}
      </div>
      <div className={styles.sizeColumn}>
        <h4>MD Size</h4>
        {VARIANTS.map((variant) => (
          <StatusComponent key={variant} variant={variant} style="outline" size="md">
            {variant}
          </StatusComponent>
        ))}
      </div>
    </div>
  ),
};

// Real-world examples
export const SystemStatuses: Story = {
  render: () => (
    <div className={styles.examplesGrid}>
      <StatusComponent variant="success" style="filled" size="md">Online</StatusComponent>
      <StatusComponent variant="error" style="filled" size="md">Offline</StatusComponent>
      <StatusComponent variant="warning" style="filled" size="md">Maintenance</StatusComponent>
      <StatusComponent variant="info" style="filled" size="md">Updating</StatusComponent>
      <StatusComponent variant="disabled" style="filled" size="md">Inactive</StatusComponent>
    </div>
  ),
};

export const ConnectionStates: Story = {
  render: () => (
    <div className={styles.examplesGrid}>
      <StatusComponent variant="success" style="outline" size="xs">Connected</StatusComponent>
      <StatusComponent variant="error" style="outline" size="xs">Disconnected</StatusComponent>
      <StatusComponent variant="warning" style="outline" size="xs">Reconnecting</StatusComponent>
      <StatusComponent variant="info" style="outline" size="xs">Authenticating</StatusComponent>
    </div>
  ),
};

export const DataQuality: Story = {
  render: () => (
    <div className={styles.examplesGrid}>
      <StatusComponent variant="data" style="filled" size="md">Live Data</StatusComponent>
      <StatusComponent variant="data" style="outline" size="md">Cached</StatusComponent>
      <StatusComponent variant="warning" style="filled" size="md">Stale</StatusComponent>
      <StatusComponent variant="error" style="filled" size="md">Invalid</StatusComponent>
    </div>
  ),
};

export const UserStatuses: Story = {
  render: () => (
    <div className={styles.examplesGrid}>
      <StatusComponent variant="success" style="filled" size="xs">Active</StatusComponent>
      <StatusComponent variant="neutral" style="filled" size="xs">Away</StatusComponent>
      <StatusComponent variant="warning" style="filled" size="xs">Busy</StatusComponent>
      <StatusComponent variant="disabled" style="filled" size="xs">Offline</StatusComponent>
    </div>
  ),
};

export const DeploymentStatuses: Story = {
  render: () => (
    <div className={styles.examplesGrid}>
      <StatusComponent variant="success" style="filled" size="md">Deployed</StatusComponent>
      <StatusComponent variant="info" style="filled" size="md">Building</StatusComponent>
      <StatusComponent variant="warning" style="filled" size="md">Queued</StatusComponent>
      <StatusComponent variant="error" style="filled" size="md">Failed</StatusComponent>
      <StatusComponent variant="neutral" style="filled" size="md">Cancelled</StatusComponent>
    </div>
  ),
};

// Legacy export for backwards compatibility
export const Status = Default;