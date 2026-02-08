import {
  Gear,
  Gauge,
  SignOut,
  UserCircle,
  Lifebuoy,
  BookOpen,
} from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import type { ActionMenuItem } from "../ActionsMenu";
import { LeftNav } from "./LeftNav";
import { ButtonLink } from "../NavigationButtonLink";

const actionMenuItems: ActionMenuItem[] = [
  {
    key: "profile",
    component: "Profile",
    icon: UserCircle,
  },
  {
    key: "settings",
    component: "Settings",
    icon: Gear,
  },
  {
    key: "sign-out",
    component: "Sign out",
    icon: SignOut,
  },
];

const defaultLinks = (
  <>
    <ButtonLink beforeIcon={Gauge} href="/dashboard">
      Dashboard
    </ButtonLink>
    <ButtonLink href="/feeds" beforeIcon={UserCircle}>
      Feeds
    </ButtonLink>
    <ButtonLink href="/settings" beforeIcon={Gear}>
      Settings
    </ButtonLink>
  </>
);

const LeftNavStory: Meta<typeof LeftNav>["render"] = (args) => {
  /** state */
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <LeftNav {...args} collapsed={collapsed} onCollapseChange={setCollapsed}>
        {args.children ?? defaultLinks}
      </LeftNav>
      <div style={{ flex: 1 }} />
    </div>
  );
};

const meta = {
  title: "V2/LeftNav",
  component: LeftNav,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    actionMenuItems,
    additionalUserMeta: "Admin",
    collapsed: false,
    currentUser: {
      avatarUrl: "https://i.pravatar.cc/120?img=32",
      email: "riley.chen@pyth.network",
      fullName: "Riley Chen",
    },
    supportLinks: (
      <>
        <ButtonLink
          beforeIcon={Lifebuoy}
          href="#"
          onClick={(e) => {
            e.preventDefault();
          }}
          size="sm"
        >
          Support
        </ButtonLink>
        <ButtonLink
          beforeIcon={BookOpen}
          href="#"
          onClick={(e) => {
            e.preventDefault();
          }}
          size="sm"
        >
          Documentation
        </ButtonLink>
      </>
    ),
  },
  argTypes: {
    children: { control: false },
    onCollapseChange: { action: "onCollapseChange" },
  },
  render: LeftNavStory,
} satisfies Meta<typeof LeftNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
