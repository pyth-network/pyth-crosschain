import * as icons from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { iconControl } from "../icon-control.jsx";
import { NoResults as NoResultsComponent } from "./index.jsx";

const meta = {
  title: "layouts & pages/NoResults",
  component: NoResultsComponent,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `The NoResults component has two modes:
        
1. **Query Mode**: Pass a \`query\` prop to show search-related no results message
2. **Custom Content Mode**: Pass \`icon\`, \`header\`, and \`body\` props together for custom messaging

You cannot mix props from both modes.`,
      },
    },
  },
  argTypes: {
    query: {
      control: "text",
      description: "Search query to display (use this OR custom content props)",
      table: {
        category: "Query Mode",
        type: { summary: "string" },
      },
    },
    icon: {
      ...iconControl,
      description: "Custom icon to display (requires header and body)",
      table: {
        category: "Custom Content Mode",
      },
    },
    header: {
      control: "text",
      description: "Custom header text (requires icon and body)",
      table: {
        category: "Custom Content Mode",
        type: { summary: "ReactNode" },
      },
    },
    body: {
      control: "text",
      description: "Custom body text (requires icon and header)",
      table: {
        category: "Custom Content Mode",
        type: { summary: "ReactNode" },
      },
    },
    variant: {
      control: "select",
      options: ["success", "error", "warning", "info", "data"],
      description: "Visual variant (only applies in custom content mode)",
      table: {
        category: "Custom Content Mode",
        defaultValue: { summary: "info" },
      },
    },
    onClearSearch: {
      description: "Callback when clear search button is clicked",
      table: {
        category: "Common",
      },
    },
    className: {
      control: "text",
      description: "Additional CSS class name",
      table: {
        category: "Common",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof NoResultsComponent>;
export default meta;

type Story = StoryObj<typeof NoResultsComponent>;

export const WithQuery: Story = {
  args: {
    query: "bitcoin price feed",
    onClearSearch: fn(),
  },
};

export const EmptyQuery: Story = {
  args: {
    query: "",
    onClearSearch: fn(),
  },
};

export const WithoutClearButton: Story = {
  args: {
    query: "ethereum",
  },
};

export const CustomContent: Story = {
  args: {
    icon: <icons.Package />,
    header: "No products found",
    body: "Try adjusting your filters or search terms to find what you're looking for.",
    onClearSearch: fn(),
  },
};

export const ErrorVariant: Story = {
  args: {
    icon: <icons.XCircle />,
    header: "Failed to load results",
    body: "Something went wrong while fetching your data. Please try again later.",
    variant: "error",
  },
};

export const SuccessVariant: Story = {
  args: {
    icon: <icons.CheckCircle />,
    header: "All tasks completed!",
    body: "You've finished all your tasks. Take a break or add new ones.",
    variant: "success",
  },
};

export const WarningVariant: Story = {
  args: {
    icon: <icons.Warning />,
    header: "No active feeds",
    body: "There are currently no active price feeds matching your criteria.",
    variant: "warning",
  },
};

export const DataVariant: Story = {
  args: {
    icon: <icons.Database />,
    header: "No data available",
    body: "Historical data for this time period is not available.",
    variant: "data",
  },
};

export const EmptyInbox: Story = {
  args: {
    icon: <icons.Envelope />,
    header: "Your inbox is empty",
    body: "When you receive messages, they'll appear here.",
  },
};

export const NoFavorites: Story = {
  args: {
    icon: <icons.Star />,
    header: "No favorites yet",
    body: "Star your favorite items to quickly access them here.",
  },
};

export const LongQuery: Story = {
  args: {
    query:
      "This is a very long search query that someone might type when looking for something very specific in the application",
    onClearSearch: fn(),
  },
};
