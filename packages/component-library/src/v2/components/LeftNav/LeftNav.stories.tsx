import {
  BookOpen,
  Gauge,
  Gear,
  Lifebuoy,
  SignOut,
  UserCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import type { ActionMenuItem } from "../ActionsMenu";
import { ButtonLink } from "../NavigationButtonLink";
import { LeftNav } from "./LeftNav";

const actionMenuItems: ActionMenuItem[] = [
  {
    component: "Profile",
    icon: UserCircle,
    key: "profile",
  },
  {
    component: "Settings",
    icon: Gear,
    key: "settings",
  },
  {
    component: "Sign out",
    icon: SignOut,
    key: "sign-out",
  },
];

const defaultLinks = (
  <>
    <ButtonLink beforeIcon={Gauge} href="/dashboard">
      Dashboard
    </ButtonLink>
    <ButtonLink beforeIcon={UserCircle} href="/feeds">
      Feeds
    </ButtonLink>
    <ButtonLink beforeIcon={Gear} href="/settings">
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
  component: LeftNav,
  parameters: {
    layout: "fullscreen",
  },
  render: LeftNavStory,
  title: "V2/LeftNav",
} satisfies Meta<typeof LeftNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
