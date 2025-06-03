import type { Meta, StoryObj } from "@storybook/react";
import { ThemeProvider } from "next-themes";

import { TabRoot } from "../AppShell/tabs.jsx";
import { Badge } from "../Badge/index.jsx";
import { Button } from "../Button/index.jsx";
import { MainNavTabs } from "../MainNavTabs/index.jsx";
import { Header as HeaderComponent } from "./index.jsx";

const meta = {
  title: "navigation & menus/Header",
  component: HeaderComponent,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
  globals: {
    background: "primary",
  },
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    appName: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof HeaderComponent>;
export default meta;

export const Header = {
  args: {
    appName: "Component Library",
  },
} satisfies StoryObj<typeof HeaderComponent>;

type Story = StoryObj<typeof HeaderComponent>;

export const Default: Story = {
  args: {
    appName: "Price Feeds",
  },
};

export const WithCustomCTA: Story = {
  args: {
    appName: "Benchmarks",
    mainCta: {
      label: "Get Started",
      href: "https://pyth.network",
    },
  },
};

export const WithMainMenu: Story = {
  args: {
    appName: "Developer Hub",
  },
  decorators: [
    (Story) => (
      <TabRoot>
        <Story />
      </TabRoot>
    ),
  ],
  render: (args) => (
    <HeaderComponent
      {...args}
      mainMenu={
        <MainNavTabs
          tabs={[
            { children: "Overview", segment: "" },
            { children: "Price Feeds", segment: "price-feeds" },
            { children: "Benchmarks", segment: "benchmarks" },
            { children: "API Reference", segment: "api" },
          ]}
        />
      }
    />
  ),
};

export const WithExtraCTA: Story = {
  args: {
    appName: "Pyth Network",
    extraCta: (
      <>
        <Badge variant="info">Beta</Badge>
        <Button size="sm" variant="outline" rounded>
          Connect Wallet
        </Button>
      </>
    ),
  },
};

export const CompleteExample: Story = {
  args: {
    appName: "Oracle Dashboard",
    mainCta: {
      label: "Documentation",
      href: "https://docs.pyth.network",
    },
  },
  decorators: [
    (Story) => (
      <TabRoot>
        <Story />
      </TabRoot>
    ),
  ],
  render: (args) => (
    <HeaderComponent
      {...args}
      mainMenu={
        <MainNavTabs
          tabs={[
            { children: "Dashboard", segment: "" },
            { children: "Analytics", segment: "analytics" },
            { children: "Settings", segment: "settings" },
          ]}
        />
      }
      extraCta={
        <>
          <Badge variant="success">Live</Badge>
          <Button size="sm" variant="ghost" rounded>
            0x1234...5678
          </Button>
        </>
      }
    />
  ),
};

export const MinimalHeader: Story = {
  args: {
    appName: "Pyth App",
    mainCta: undefined,
    mainMenu: undefined,
    extraCta: undefined,
  },
};
