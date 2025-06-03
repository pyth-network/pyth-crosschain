import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useState } from "react";

import { SearchInput as SearchInputComponent, SIZES } from "./index.jsx";
import styles from "./index.stories.module.scss";

const meta = {
  title: "forms & controls/SearchInput",
  component: SearchInputComponent,
  argTypes: {
    label: {
      table: {
        disable: true,
      },
    },
    size: {
      control: "inline-radio",
      options: SIZES,
      table: {
        category: "Size",
      },
    },
    width: {
      control: "number",
      table: {
        category: "Size",
      },
    },
    isPending: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    isDisabled: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    placeholder: {
      control: "text",
      table: {
        category: "Content",
      },
    },
    defaultValue: {
      control: "text",
      table: {
        category: "Content",
      },
    },
    onSubmit: {
      action: "submitted",
      table: {
        category: "Events",
      },
    },
    onChange: {
      action: "changed",
      table: {
        category: "Events",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SearchInputComponent>;
export default meta;

export const SearchInput = {
  args: {
    size: "md",
    width: 60,
    isPending: false,
    isDisabled: false,
  },
} satisfies StoryObj<typeof SearchInputComponent>;

type Story = StoryObj<typeof SearchInputComponent>;

// Size variations
export const ExtraSmall: Story = {
  args: {
    size: "xs",
    placeholder: "Search...",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    placeholder: "Search...",
  },
};

export const Medium: Story = {
  args: {
    size: "md",
    placeholder: "Search...",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    placeholder: "Search...",
  },
};

// State variations
export const WithValue: Story = {
  args: {
    size: "md",
    defaultValue: "pyth network",
  },
};

export const Pending: Story = {
  args: {
    size: "md",
    isPending: true,
    defaultValue: "searching...",
  },
};

export const Disabled: Story = {
  args: {
    size: "md",
    isDisabled: true,
    placeholder: "Search disabled",
  },
};

// Width variations
export const FixedWidth: Story = {
  args: {
    size: "md",
    width: 100,
    placeholder: "Fixed width",
  },
};

export const FluidWidth: Story = {
  args: {
    size: "md",
    placeholder: "Fluid width (default)",
  },
};

// Functional examples
export const WithSubmitHandler: Story = {
  args: {
    size: "md",
    placeholder: "Press Enter to search",
    onSubmit: fn(),
  },
};

export const ControlledInput: Story = {
  render: () => {
    const [value, setValue] = useState("");
    
    return (
      <div className={styles.controlledContainer}>
        <SearchInputComponent
          value={value}
          onChange={setValue}
          onSubmit={() => alert(`Searching for: ${value}`)}
          placeholder="Controlled search input"
        />
        <p>Current value: {value}</p>
      </div>
    );
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className={styles.sizesContainer}>
      {SIZES.map((size) => (
        <SearchInputComponent
          key={size}
          size={size}
          placeholder={`Size: ${size}`}
        />
      ))}
    </div>
  ),
};

export const AllStates: Story = {
  render: () => (
    <div className={styles.statesContainer}>
      <SearchInputComponent placeholder="Default state" />
      <SearchInputComponent defaultValue="With value" />
      <SearchInputComponent isPending defaultValue="Loading results..." />
      <SearchInputComponent isDisabled placeholder="Disabled" />
    </div>
  ),
};
