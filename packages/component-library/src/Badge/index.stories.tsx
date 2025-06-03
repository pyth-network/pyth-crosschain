import type { Meta, StoryObj } from "@storybook/react";

import { Badge as BadgeComponent, SIZES, STYLES, VARIANTS } from "./index.jsx";
import styles from "./index.stories.module.scss";

const meta = {
  title: "building blocks/Badge",
  component: BadgeComponent,
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
} satisfies Meta<typeof BadgeComponent>;
export default meta;

export const Badge = {
  args: {
    children: "A BADGE",
    variant: "neutral",
    style: "filled",
    size: "md",
  },
} satisfies StoryObj<typeof BadgeComponent>;

type Story = StoryObj<typeof BadgeComponent>;

const renderAllVariants = (
  style: (typeof STYLES)[number],
  size: (typeof SIZES)[number],
  children: React.ReactNode,
) => (
  <div className={styles.variantsContainer}>
    {VARIANTS.map((variant) => (
      <BadgeComponent key={variant} variant={variant} style={style} size={size}>
        {children}
      </BadgeComponent>
    ))}
  </div>
);

export const FilledXS: Story = {
  args: {
    children: "Badge",
  },
  render: ({ children }) => renderAllVariants("filled", "xs", children),
  argTypes: {
    variant: { table: { disable: true } },
    style: { table: { disable: true } },
    size: { table: { disable: true } },
  },
  parameters: {
    docs: {
      description: {
        story: "Extra small filled badges in all variants",
      },
    },
  },
};

export const FilledMD: Story = {
  args: {
    children: "Badge",
  },
  render: ({ children }) => renderAllVariants("filled", "md", children),
  argTypes: {
    variant: { table: { disable: true } },
    style: { table: { disable: true } },
    size: { table: { disable: true } },
  },
  parameters: {
    docs: {
      description: {
        story: "Medium filled badges in all variants",
      },
    },
  },
};

export const FilledLG: Story = {
  args: {
    children: "Badge",
  },
  render: ({ children }) => renderAllVariants("filled", "lg", children),
  argTypes: {
    variant: { table: { disable: true } },
    style: { table: { disable: true } },
    size: { table: { disable: true } },
  },
  parameters: {
    docs: {
      description: {
        story: "Large filled badges in all variants",
      },
    },
  },
};

export const OutlineXS: Story = {
  args: {
    children: "Badge",
  },
  render: ({ children }) => renderAllVariants("outline", "xs", children),
  argTypes: {
    variant: { table: { disable: true } },
    style: { table: { disable: true } },
    size: { table: { disable: true } },
  },
  parameters: {
    docs: {
      description: {
        story: "Extra small outline badges in all variants",
      },
    },
  },
};

export const OutlineMD: Story = {
  args: {
    children: "Badge",
  },
  render: ({ children }) => renderAllVariants("outline", "md", children),
  argTypes: {
    variant: { table: { disable: true } },
    style: { table: { disable: true } },
    size: { table: { disable: true } },
  },
  parameters: {
    docs: {
      description: {
        story: "Medium outline badges in all variants",
      },
    },
  },
};

export const OutlineLG: Story = {
  args: {
    children: "Badge",
  },
  render: ({ children }) => renderAllVariants("outline", "lg", children),
  argTypes: {
    variant: { table: { disable: true } },
    style: { table: { disable: true } },
    size: { table: { disable: true } },
  },
  parameters: {
    docs: {
      description: {
        story: "Large outline badges in all variants",
      },
    },
  },
};
