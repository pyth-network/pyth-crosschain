import { setTimeout } from "node:timers/promises";

import { render } from "@testing-library/react";

import { DocumentTitle } from ".";

describe("<DocumentTitle /> tests", () => {
  afterEach(() => {
    document.title = "";
  });

  it("should fully overwrite the page title on load", () => {
    const title = "pizza pasta pepperoni";
    render(<DocumentTitle title={title} />);

    expect(document.title).toBe(title);
  });

  it("should update the title once, then after a delay, do it again", async () => {
    const title1 = "uno";
    const { rerender } = render(<DocumentTitle title={title1} />);

    expect(document.title).toBe(title1);

    const title2 = "dos";

    await setTimeout(500);
    rerender(<DocumentTitle title={title2} />);

    expect(document.title).toBe(title2);
  });

  it("should prepend a prefix", () => {
    const initial = "initial title";
    document.title = initial;

    const prefix = "pizza pasta pepperoni";
    render(<DocumentTitle prefix title={prefix} />);

    expect(document.title).toBe(`${prefix} | ${initial}`);
  });

  it("should prepend a prefix once, wait a bit, then do it again", async () => {
    const initial = "initial title";
    document.title = initial;

    const prefix1 = "pizza pasta pepperoni";
    const { rerender } = render(<DocumentTitle prefix title={prefix1} />);

    expect(document.title).toBe(`${prefix1} | ${initial}`);

    await setTimeout(200);

    const prefix2 = "tacos and burritos";
    rerender(<DocumentTitle prefix title={prefix2} />);

    expect(document.title).toBe(`${prefix2} | ${initial}`);
  });
});
