import * as Icon from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../Button/index.jsx";
import { useAlert as useAlertImpl } from "./index.jsx";

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
  argTypes: {
    children: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    icon: {
      control: "select",
      mapping: Object.fromEntries(
        Object.entries(Icon).map(([key, Icon]) => [
          key,
          <Icon key={key} weights={new Map()} />,
        ]),
      ),
      options: Object.keys(Icon),
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
  },
  component: ShowButton,
  title: "hooks/useAlert",
} satisfies Meta<typeof ShowButton>;
export default meta;

export const useAlert = {
  args: {
    children:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
    title: "An Alert",
  },
  name: "useAlert",
} satisfies StoryObj<typeof ShowButton>;
