import cx from "clsx";
import type { ReactElement, HTMLAttributes } from "react";
import { cloneElement, isValidElement } from "react";

import type { TextColorToken } from "./Text.styles";
import { classes } from "./Text.styles";
import type { FontSize, ThemeV2 } from "../../theme";

export type TextProps = HTMLAttributes<HTMLElement> & {
  /**
   * if set, will render this as an emboldened item
   * of your choice
   */

  bold?: keyof typeof ThemeV2.tokens.fontWeights;

  /**
   * if specified, will use this color
   * when rendering the text
   */

  color?: TextColorToken;

  /**
   * if true, will render this in italics
   *
   * @defaultValue false
   */

  italic?: boolean;

  /**
   * if specified, will use this as the base node
   * in which text will be rendered.
   *
   * @defaultValue <span />
   */

  render?: ReactElement;

  /**
   * if specified, will render the text in this specific font size
   */
  size?: FontSize;
};

export function Text({
  bold,
  className,
  children,
  color,
  italic = false,
  render = <span />,
  size,
  ...otherProps
}: TextProps) {
  const internalProps = {
    className: cx(classes.root, className),
    children,
    "data-color": color,
    "data-bold": bold,
    "data-italic": italic,
    "data-size": size,
    ...otherProps,
  };

  if (isValidElement(render)) {
    const renderProps = render.props as HTMLAttributes<HTMLElement>;

    return cloneElement(render as ReactElement<HTMLAttributes<HTMLElement>>, {
      ...internalProps,
      ...renderProps,
      className: cx(internalProps.className, renderProps.className),
      style: { ...internalProps.style, ...renderProps.style },
      children: children ?? renderProps.children,
    });
  }

  return <span {...internalProps} />;
}
