import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { Button } from "react-aria-components";

import { Popover } from ".";
import styles from "./index.module.scss";

const classes = styles as { menu: string; popoverRoot: string };

const renderPopover = (popover: ReactElement) => {
  render(popover);

  const root = screen.getByRole("dialog").closest(`.${classes.popoverRoot}`);

  if (root === null) {
    throw new Error("popover root not found");
  }

  return root;
};

describe("<Popover /> tests", () => {
  it("should render on the tooltip surface by default", () => {
    const root = renderPopover(
      <Popover defaultOpen popoverContents="contents">
        <Button>open</Button>
      </Popover>,
    );

    expect(root.classList.contains(classes.menu)).toBe(false);
  });

  it("should render on the menu surface when the menu variant is selected", () => {
    const root = renderPopover(
      <Popover defaultOpen popoverContents="contents" variant="menu">
        <Button>open</Button>
      </Popover>,
    );

    expect(root.classList.contains(classes.menu)).toBe(true);
  });
});
