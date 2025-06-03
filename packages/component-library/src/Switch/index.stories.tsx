import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useState } from "react";

import { Switch as SwitchComponent } from "./index.jsx";
import styles from "./index.stories.module.scss";

const meta = {
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
        <SwitchComponent defaultSelected onChange={fn()}>Selected</SwitchComponent>
        <span className={styles.description}>Selected state</span>
      </div>
      <div className={styles.stateRow}>
        <SwitchComponent isDisabled onChange={fn()}>Disabled</SwitchComponent>
        <span className={styles.description}>Disabled state</span>
      </div>
      <div className={styles.stateRow}>
        <SwitchComponent isDisabled defaultSelected onChange={fn()}>Disabled Selected</SwitchComponent>
        <span className={styles.description}>Disabled & selected</span>
      </div>
      <div className={styles.stateRow}>
        <SwitchComponent isPending onChange={fn()}>Pending</SwitchComponent>
        <span className={styles.description}>Loading state</span>
      </div>
      <div className={styles.stateRow}>
        <SwitchComponent isPending defaultSelected onChange={fn()}>Pending Selected</SwitchComponent>
        <span className={styles.description}>Loading & selected</span>
      </div>
    </div>
  ),
};

export const ControlledExample: Story = {
  render: () => {
    const [isSelected, setIsSelected] = useState(false);
    const handleChange = fn((value: boolean) => {
      setIsSelected(value);
    });

    return (
      <div className={styles.controlledContainer}>
        <SwitchComponent
          isSelected={isSelected}
          onChange={handleChange}
        >
          Controlled switch
        </SwitchComponent>
        <p>Switch is {isSelected ? "ON" : "OFF"}</p>
      </div>
    );
  },
};

export const WithAsyncAction: Story = {
  render: () => {
    const [isSelected, setIsSelected] = useState(false);
    const [isPending, setIsPending] = useState(false);
    
    const handleChange = fn(async (value: boolean) => {
      setIsPending(true);
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsSelected(value);
      setIsPending(false);
    });

    return (
      <div className={styles.controlledContainer}>
        <SwitchComponent
          isSelected={isSelected}
          onChange={handleChange}
          isPending={isPending}
        >
          Save to server
        </SwitchComponent>
        <p>{isPending ? "Saving..." : `Saved state: ${isSelected ? "ON" : "OFF"}`}</p>
      </div>
    );
  },
};

export const SettingsExample: Story = {
  render: () => {
    const [settings, setSettings] = useState({
      notifications: true,
      darkMode: false,
      autoSave: true,
      analytics: false,
    });

    const handleSettingChange = (setting: keyof typeof settings) => 
      fn((value: boolean) => {
        setSettings(prev => ({ ...prev, [setting]: value }));
      });

    return (
      <div className={styles.settingsList}>
        <div className={styles.settingItem}>
          <SwitchComponent
            isSelected={settings.notifications}
            onChange={handleSettingChange('notifications')}
          >
            Push notifications
          </SwitchComponent>
          <span className={styles.settingDescription}>
            Receive alerts for important updates
          </span>
        </div>
        <div className={styles.settingItem}>
          <SwitchComponent
            isSelected={settings.darkMode}
            onChange={handleSettingChange('darkMode')}
          >
            Dark mode
          </SwitchComponent>
          <span className={styles.settingDescription}>
            Use dark theme for better night viewing
          </span>
        </div>
        <div className={styles.settingItem}>
          <SwitchComponent
            isSelected={settings.autoSave}
            onChange={handleSettingChange('autoSave')}
          >
            Auto-save
          </SwitchComponent>
          <span className={styles.settingDescription}>
            Automatically save your work
          </span>
        </div>
        <div className={styles.settingItem}>
          <SwitchComponent
            isSelected={settings.analytics}
            onChange={handleSettingChange('analytics')}
            isDisabled
          >
            Analytics (Pro only)
          </SwitchComponent>
          <span className={styles.settingDescription}>
            Advanced usage analytics
          </span>
        </div>
      </div>
    );
  },
};

export const FeatureFlags: Story = {
  render: () => {
    const [flags, setFlags] = useState({
      betaFeatures: false,
      experimentalApi: false,
      debugMode: false,
    });
    const [pendingFlags, setPendingFlags] = useState<string[]>([]);

    const handleFlagChange = (flag: keyof typeof flags) => 
      fn(async (value: boolean) => {
        setPendingFlags(prev => [...prev, flag]);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        setFlags(prev => ({ ...prev, [flag]: value }));
        setPendingFlags(prev => prev.filter(f => f !== flag));
      });

    return (
      <div className={styles.featureFlags}>
        <h3>Feature Flags</h3>
        <div className={styles.flagItem}>
          <SwitchComponent
            isSelected={flags.betaFeatures}
            onChange={handleFlagChange('betaFeatures')}
            isPending={pendingFlags.includes('betaFeatures')}
          >
            Enable beta features
          </SwitchComponent>
        </div>
        <div className={styles.flagItem}>
          <SwitchComponent
            isSelected={flags.experimentalApi}
            onChange={handleFlagChange('experimentalApi')}
            isPending={pendingFlags.includes('experimentalApi')}
          >
            Use experimental API
          </SwitchComponent>
        </div>
        <div className={styles.flagItem}>
          <SwitchComponent
            isSelected={flags.debugMode}
            onChange={handleFlagChange('debugMode')}
            isPending={pendingFlags.includes('debugMode')}
          >
            Debug mode
          </SwitchComponent>
        </div>
      </div>
    );
  },
};

export const PermissionsExample: Story = {
  render: () => {
    const permissions = [
      { id: 'read', label: 'Read access', enabled: true, locked: false },
      { id: 'write', label: 'Write access', enabled: false, locked: false },
      { id: 'delete', label: 'Delete access', enabled: false, locked: true },
      { id: 'admin', label: 'Admin access', enabled: false, locked: true },
    ];

    return (
      <div className={styles.permissionsList}>
        <h3>User Permissions</h3>
        {permissions.map(permission => (
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

export const ErrorHandling: Story = {
  render: () => {
    const [isSelected, setIsSelected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);
    
    const handleChange = fn(async (value: boolean) => {
      setError(null);
      setIsPending(true);
      
      try {
        // Simulate API call that might fail
        await new Promise((resolve, reject) => {
          setTimeout(() => {
            if (Math.random() > 0.5) {
              resolve(true);
            } else {
              reject(new Error("Failed to update setting"));
            }
          }, 1000);
        });
        setIsSelected(value);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsPending(false);
      }
    });

    return (
      <div className={styles.errorExample}>
        <SwitchComponent
          isSelected={isSelected}
          onChange={handleChange}
          isPending={isPending}
        >
          Risky operation (50% failure rate)
        </SwitchComponent>
        {error && (
          <div className={styles.errorMessage}>
            ⚠️ {error}
          </div>
        )}
      </div>
    );
  },
};

// Legacy export for backwards compatibility
export const Switch = Default;