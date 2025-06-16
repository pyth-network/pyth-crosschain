import * as icons from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { Select as SelectComponent } from "./index.jsx";
import styles from "./index.stories.module.scss";
import { SIZES, VARIANTS } from "../Button/index.jsx";
import buttonMeta from "../Button/index.stories.jsx";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { children, beforeIcon, ...argTypes } = buttonMeta.argTypes;
const meta = {
  title: "forms & controls/Select",
  component: SelectComponent,
  argTypes: {
    ...argTypes,
    icon: beforeIcon,
    label: {
      control: "text",
      table: {
        category: "Label",
      },
    },
    hideLabel: {
      control: "boolean",
      table: {
        category: "Label",
      },
    },
    options: {
      table: {
        disable: true,
      },
    },
    optionGroups: {
      table: {
        disable: true,
      },
    },
    defaultSelectedKey: {
      table: {
        disable: true,
      },
    },
    show: {
      table: {
        disable: true,
      },
    },
    placement: {
      control: "select",
      options: [
        "bottom",
        "bottom left",
        "bottom right",
        "bottom start",
        "bottom end",
        "top",
        "top left",
        "top right",
        "top start",
        "top end",
        "left",
        "left top",
        "left bottom",
        "start",
        "start top",
        "start bottom",
        "right",
        "right top",
        "right bottom",
        "end",
        "end top",
        "end bottom",
      ],
      table: {
        category: "Popover",
      },
    },
    onSelectionChange: {
      table: {
        category: "Behavior",
      },
    },
    buttonLabel: {
      control: "text",
      table: {
        category: "Label",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SelectComponent>;
export default meta;

type Story = StoryObj<typeof SelectComponent>;

export const Default: Story = {
  args: {
    defaultSelectedKey: "option1",
    options: [{ id: "option1" }, { id: "option2" }, { id: "option3" }],
    variant: "primary",
    size: "md",
    hideLabel: true,
  },
};

export const BasicSelect: Story = {
  args: {
    defaultSelectedKey: "apple",
    options: [
      { id: "apple" },
      { id: "banana" },
      { id: "orange" },
      { id: "grape" },
      { id: "strawberry" },
    ],
    hideLabel: true,
    variant: "primary",
    size: "md",
  },
};

export const WithCustomDisplay: Story = {
  args: {
    defaultSelectedKey: "us",
    options: [
      { id: "us" },
      { id: "uk" },
      { id: "de" },
      { id: "fr" },
      { id: "jp" },
    ],
    show: (value) => {
      const countryNames = {
        us: "🇺🇸 United States",
        uk: "🇬🇧 United Kingdom",
        de: "🇩🇪 Germany",
        fr: "🇫🇷 France",
        jp: "🇯🇵 Japan",
      };
      return countryNames[value.id as keyof typeof countryNames] || value.id;
    },
    hideLabel: true,
    variant: "secondary",
    size: "md",
  },
};

export const WithIcon: Story = {
  args: {
    defaultSelectedKey: "payment",
    options: [
      { id: "payment" },
      { id: "shipping" },
      { id: "tracking" },
      { id: "returns" },
    ],
    show: (value) => {
      const optionLabels = {
        payment: "Payment Methods",
        shipping: "Shipping Options",
        tracking: "Order Tracking",
        returns: "Returns & Refunds",
      };
      return optionLabels[value.id as keyof typeof optionLabels] || value.id;
    },
    icon: <icons.Info />,
    hideLabel: true,
    variant: "outline",
    size: "md",
  },
};

export const Grouped: Story = {
  args: {
    defaultSelectedKey: "react",
    optionGroups: [
      {
        name: "Frontend Frameworks",
        options: [
          { id: "react" },
          { id: "vue" },
          { id: "angular" },
          { id: "svelte" },
        ],
      },
      {
        name: "Backend Frameworks",
        options: [
          { id: "express" },
          { id: "django" },
          { id: "rails" },
          { id: "laravel" },
        ],
      },
      {
        name: "Mobile Frameworks",
        options: [{ id: "react-native" }, { id: "flutter" }, { id: "ionic" }],
      },
    ],
    hideLabel: true,
    variant: "primary",
    size: "md",
  },
};

export const GroupedWithHiddenLabels: Story = {
  args: {
    defaultSelectedKey: "admin",
    optionGroups: [
      {
        name: "User Roles",
        options: [{ id: "admin" }, { id: "editor" }, { id: "viewer" }],
      },
      {
        name: "System Roles",
        options: [{ id: "super-admin" }, { id: "moderator" }],
      },
    ],
    show: (value) => {
      const roleNames = {
        admin: "Administrator",
        editor: "Editor",
        viewer: "Viewer",
        "super-admin": "Super Administrator",
        moderator: "Moderator",
      };
      return roleNames[value.id as keyof typeof roleNames] || value.id;
    },
    hideGroupLabel: true,
    hideLabel: true,
    variant: "secondary",
    size: "md",
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className={styles.grid}>
      {SIZES.map((size) => (
        <div key={size} className={styles.row}>
          <label>{size.toUpperCase()}</label>
          <SelectComponent
            defaultSelectedKey="option1"
            options={[{ id: "option1" }, { id: "option2" }, { id: "option3" }]}
            size={size}
            variant="primary"
            label={`Size ${size}`}
            hideLabel
          />
        </div>
      ))}
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className={styles.grid}>
      {VARIANTS.map((variant) => (
        <div key={variant} className={styles.row}>
          <label>{variant.toUpperCase()}</label>
          <SelectComponent
            key={variant}
            defaultSelectedKey="option1"
            options={[{ id: "option1" }, { id: "option2" }, { id: "option3" }]}
            variant={variant}
            size="md"
            label={`${variant.charAt(0).toUpperCase() + variant.slice(1)} variant`}
            hideLabel={true}
          />
        </div>
      ))}
    </div>
  ),
};

export const States: Story = {
  render: () => {
    const states = [
      { key: "normal", label: "NORMAL", props: {} },
      { key: "disabled", label: "DISABLED", props: { isDisabled: true } },
      { key: "pending", label: "PENDING", props: { isPending: true } },
      { key: "rounded", label: "ROUNDED", props: { rounded: true } },
    ];

    return (
      <div className={styles.grid}>
        {states.map((state) => (
          <div key={state.key} className={styles.row}>
            <label>{state.label}</label>
            <SelectComponent
              defaultSelectedKey="option1"
              options={[
                { id: "option1" },
                { id: "option2" },
                { id: "option3" },
              ]}
              variant="primary"
              size="md"
              label={`${state.label.toLowerCase()} state`}
              hideLabel
              {...state.props}
            />
          </div>
        ))}
      </div>
    );
  },
};

export const WithButtonLabel: Story = {
  args: {
    defaultSelectedKey: "en",
    options: [{ id: "en" }, { id: "es" }, { id: "fr" }, { id: "de" }],
    show: (value) => {
      const languages = {
        en: "English",
        es: "Español",
        fr: "Français",
        de: "Deutsch",
      };
      return languages[value.id as keyof typeof languages] || value.id;
    },
    buttonLabel: "Language",
    label: "Select language",
    hideLabel: true,
    variant: "ghost",
    size: "sm",
  },
};

export const WithDefaultButtonLabel: Story = {
  args: {
    options: [{ id: "small" }, { id: "medium" }, { id: "large" }],
    defaultButtonLabel: "Select size...",
    label: "Product size",
    hideLabel: false,
    variant: "outline",
    size: "md",
  },
};

export const PopoverPlacements: Story = {
  render: () => (
    <div className={styles.placementGrid}>
      <SelectComponent
        defaultSelectedKey="top"
        options={[{ id: "top" }, { id: "option2" }]}
        placement="top"
        label="Top placement"
        hideLabel
        variant="secondary"
        size="sm"
      />
      <SelectComponent
        defaultSelectedKey="bottom"
        options={[{ id: "bottom" }, { id: "option2" }]}
        placement="bottom"
        label="Bottom placement"
        hideLabel
        variant="secondary"
        size="sm"
      />
      <SelectComponent
        defaultSelectedKey="left"
        options={[{ id: "left" }, { id: "option2" }]}
        placement="left"
        label="Left placement"
        hideLabel
        variant="secondary"
        size="sm"
      />
    </div>
  ),
};

export const WithIconsAndCustomContent: Story = {
  render: () => (
    <div className={styles.iconsGrid}>
      <SelectComponent
        defaultSelectedKey="dashboard"
        options={[
          { id: "dashboard" },
          { id: "analytics" },
          { id: "reports" },
          { id: "settings" },
        ]}
        show={(value) => {
          const items = {
            dashboard: { icon: <icons.House />, label: "Dashboard" },
            analytics: { icon: <icons.ChartBar />, label: "Analytics" },
            reports: { icon: <icons.FileText />, label: "Reports" },
            settings: { icon: <icons.Gear />, label: "Settings" },
          };
          const item = items[value.id as keyof typeof items];
          return (
            <span className={styles.iconLabel}>
              {item.icon}
              {item.label}
            </span>
          );
        }}
        icon={<icons.NavigationArrow />}
        label="Navigation"
        hideLabel={true}
        variant="primary"
        size="md"
      />
      <SelectComponent
        defaultSelectedKey="active"
        options={[
          { id: "active" },
          { id: "inactive" },
          { id: "pending" },
          { id: "archived" },
        ]}
        show={(value) => {
          const statuses = {
            active: "Active",
            inactive: "Inactive",
            pending: "Pending",
            archived: "Archived",
          };
          const label = statuses[value.id as keyof typeof statuses];
          return (
            <span className={styles.iconLabel}>
              <span className={styles.statusIndicator} data-status={value.id} />
              {label}
            </span>
          );
        }}
        label="Status filter"
        hideLabel={true}
        variant="outline"
        size="md"
      />
    </div>
  ),
};
