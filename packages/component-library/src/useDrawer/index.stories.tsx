import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../Button/index.jsx";
import { useDrawer as useDrawerImpl } from "./index.jsx";

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
  argTypes: {
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
    title: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
  },
  component: OpenButton,
  title: "hooks/useDrawer",
} satisfies Meta<typeof OpenButton>;
export default meta;

export const useDrawer = {
  args: {
    contents: "This is a drawer",
    title: "A drawer",
  },
  name: "useDrawer",
} satisfies StoryObj<typeof OpenButton>;
