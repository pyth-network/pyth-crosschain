import type { Meta, StoryObj } from "@storybook/react";

import { ErrorPage, type Props as ErrorPageProps } from "../ErrorPage/index.jsx";
import { NetworkError as NetworkErrorStory } from "../ErrorPage/index.stories.jsx";
import { InfoBox } from "../InfoBox/index.jsx";
import { NoResults, type Props as NoResultsProps } from "../NoResults/index.jsx";
import { WarningVariant as WarningVariantStory } from "../NoResults/index.stories.jsx";
import { NotFoundPage } from "../NotFoundPage/index.jsx";
import { AppBody as AppShellComponent } from "./index.jsx";

const meta = {
  component: AppShellComponent,
  subcomponents: { ErrorPage, NoResults, NotFoundPage },
  globals: {
    args: {
    appName: "Component Library",
    children: "Hello world!",
    tabs: [
      { children: "Home", segment: "" },
      { children: "Products", segment: "products" },
      { children: "Developers", segment: "developers" },
    ],
  },
    bare: true,
    theme: {
      disable: true,
    },
  },
  parameters: {
    layout: "fullscreen",
    themes: {
      disable: true,
    },
  },
  argTypes: {
    tabs: {
      table: {
        disable: true,
      },
    },
    appName: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    children: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AppShellComponent>;
export default meta;

export const AppShell = {
  args: {
    ...meta.globals?.args,
  },
  render: (args) => (
    <AppShellComponent {...args}>
      <InfoBox>
        {args.children}
      </InfoBox>
    </AppShellComponent>
  )
} satisfies StoryObj<typeof AppShellComponent>;

type Story = StoryObj<typeof meta>;

export const ErrorStory: Story = {
  args: {
    ...meta.globals?.args,
  },
  render: (args) => (
    <AppShellComponent {...args}>
      <ErrorPage {...NetworkErrorStory.args as ErrorPageProps} />
    </AppShellComponent>
  )
};

export const NoResultsStory: Story = {
  args: {
    ...meta.globals?.args,
  },
  render: (args) => (
    <AppShellComponent {...args}>
      <NoResults {...WarningVariantStory.args as NoResultsProps} />
    </AppShellComponent>
  )
};

export const NotFoundStory: Story = {
  args: {
    ...meta.globals?.args,
  },
  render: (args) => (
    <AppShellComponent {...args}>
      <NotFoundPage />
    </AppShellComponent>
  )
};