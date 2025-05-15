import * as Icon from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { useAlert as useAlertImpl } from "./index.jsx";
import { Button } from "../Button/index.jsx";

const ShowButton = (
  props: Parameters<ReturnType<typeof useAlertImpl>["open"]>[0],
) => {
  const drawer = useAlertImpl();
  return (
    <Button
      onPress={() => {
        drawer.open(props);
      }}
    >
      Show alert
    </Button>
  );
};

const meta = {
  title: "hooks/useAlert",
  component: ShowButton,
  argTypes: {
    icon: {
      control: "select",
      options: Object.keys(Icon),
      mapping: Object.fromEntries(
        Object.entries(Icon).map(([key, Icon]) => [
          key,
          <Icon weights={new Map()} key={key} />,
        ]),
      ),
      table: {
        category: "Contents",
      },
    },
    title: {
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
} satisfies Meta<typeof ShowButton>;
export default meta;

export const useAlert = {
  name: "useAlert",
  args: {
    title: "An Alert",
    children:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  },
} satisfies StoryObj<typeof ShowButton>;
