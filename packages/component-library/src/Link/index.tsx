import clsx from "clsx";
import type { LinkProps } from "react-aria-components";

import styles from "./index.module.scss";
import { UnstyledLink } from "../UnstyledLink/index.js";

export const Link = ({ className, ...props }: LinkProps) => (
  <UnstyledLink className={clsx(styles.link, className)} {...props} />
);
