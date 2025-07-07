import type { Meta, StoryObj } from "@storybook/react";

import { useDrawer as useDrawerImpl } from "./index.jsx";
import { Button } from "../Button/index.jsx";

const OpenButton = (
  props: Parameters<ReturnType<typeof useDrawerImpl>["open"]>[0],
) => {
  const drawer = useDrawerImpl();
  return (
    <Button
      onPress={() => {
        drawer.open(props);
      }}
    >
      Open drawer
    </Button>
  );
};

const meta = {
  title: "hooks/useDrawer",
  component: OpenButton,
  argTypes: {
    title: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    contents: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    onClose: {
      table: {
        category: "Behavior",
      },
    },
    onCloseFinished: {
      table: {
        category: "Behavior",
      },
    },
  },
} satisfies Meta<typeof OpenButton>;
export default meta;

export const useDrawer = {
  name: "useDrawer",
  args: {
    title: "A drawer",
    contents: "This is a drawer",
  },
} satisfies StoryObj<typeof OpenButton>;
