import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { Switch as SwitchComponent } from "./index.jsx";
import styles from "./index.stories.module.scss";

const meta = {
  title: "forms & controls/Switch",
  component: SwitchComponent,
  argTypes: {
    isDisabled: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    isPending: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    isSelected: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    defaultSelected: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    onChange: {
      action: "changed",
      table: {
        category: "Behavior",
      },
    },
    children: {
      control: "text",
      table: {
        category: "Label",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SwitchComponent>;
export default meta;

type Story = StoryObj<typeof SwitchComponent>;

export const Default: Story = {
  args: {
    children: "Enable feature",
    onChange: fn(),
  },
};

export const WithLabel: Story = {
  args: {
    children: "Enable notifications",
    onChange: fn(),
  },
};

export const DefaultSelected: Story = {
  args: {
    children: "Already enabled",
    defaultSelected: true,
    onChange: fn(),
  },
};

export const Disabled: Story = {
  args: {
    children: "Disabled switch",
    isDisabled: true,
    onChange: fn(),
  },
};

export const DisabledSelected: Story = {
  args: {
    children: "Disabled but selected",
    isDisabled: true,
    defaultSelected: true,
    onChange: fn(),
  },
};

export const Pending: Story = {
  args: {
    children: "Loading...",
    isPending: true,
    onChange: fn(),
  },
};

export const PendingSelected: Story = {
  args: {
    children: "Saving changes...",
    isPending: true,
    defaultSelected: true,
    onChange: fn(),
  },
};

export const AllStates: Story = {
  render: () => (
    <div className={styles.statesGrid}>
      <div className={styles.stateRow}>
        <SwitchComponent onChange={fn()}>Normal</SwitchComponent>
        <span className={styles.description}>Default state</span>
      </div>
      <div className={styles.stateRow}>
        <SwitchComponent defaultSelected onChange={fn()}>
          Selected
        </SwitchComponent>
        <span className={styles.description}>Selected state</span>
      </div>
      <div className={styles.stateRow}>
        <SwitchComponent isDisabled onChange={fn()}>
          Disabled
        </SwitchComponent>
        <span className={styles.description}>Disabled state</span>
      </div>
      <div className={styles.stateRow}>
        <SwitchComponent isDisabled defaultSelected onChange={fn()}>
          Disabled Selected
        </SwitchComponent>
        <span className={styles.description}>Disabled & selected</span>
      </div>
      <div className={styles.stateRow}>
        <SwitchComponent isPending onChange={fn()}>
          Pending
        </SwitchComponent>
        <span className={styles.description}>Loading state</span>
      </div>
      <div className={styles.stateRow}>
        <SwitchComponent isPending defaultSelected onChange={fn()}>
          Pending Selected
        </SwitchComponent>
        <span className={styles.description}>Loading & selected</span>
      </div>
    </div>
  ),
};

export const PermissionsExample: Story = {
  render: () => {
    const permissions = [
      { id: "read", label: "Read access", enabled: true, locked: false },
      { id: "write", label: "Write access", enabled: false, locked: false },
      { id: "delete", label: "Delete access", enabled: false, locked: true },
      { id: "admin", label: "Admin access", enabled: false, locked: true },
    ];

    return (
      <div className={styles.permissionsList}>
        <h3>User Permissions</h3>
        {permissions.map((permission) => (
          <div key={permission.id} className={styles.permissionItem}>
            <SwitchComponent
              defaultSelected={permission.enabled}
              isDisabled={permission.locked}
              onChange={fn()}
            >
              {permission.label}
            </SwitchComponent>
            {permission.locked && (
              <span className={styles.lockedBadge}>Requires upgrade</span>
            )}
          </div>
        ))}
      </div>
    );
  },
};

export const WithCustomLabels: Story = {
  render: () => (
    <div className={styles.customLabels}>
      <SwitchComponent onChange={fn()}>
        {({ isSelected }) => (
          <span className={styles.dynamicLabel}>
            {isSelected ? "🌙 Night mode" : "☀️ Day mode"}
          </span>
        )}
      </SwitchComponent>
      <SwitchComponent onChange={fn()}>
        {({ isSelected }) => (
          <span className={styles.dynamicLabel}>
            Status: <strong>{isSelected ? "Active" : "Inactive"}</strong>
          </span>
        )}
      </SwitchComponent>
      <SwitchComponent onChange={fn()}>
        {({ isSelected }) => (
          <span className={styles.dynamicLabel}>
            {isSelected ? "✅ Subscribed" : "❌ Unsubscribed"}
          </span>
        )}
      </SwitchComponent>
    </div>
  ),
};

// Legacy export for backwards compatibility
export const Switch = Default;
