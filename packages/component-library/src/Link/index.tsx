import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";
import { Link as UnstyledLink } from "../unstyled/Link/index.js";

type OwnProps = {
  invert?: boolean | undefined;
};
type Props = Omit<ComponentProps<typeof UnstyledLink>, keyof OwnProps> &
  OwnProps;

export const Link = ({ className, invert, ...props }: Props) => (
  <UnstyledLink
    className={clsx(styles.link, className)}
    data-invert={invert ? "" : undefined}
    {...props}
  />
);
