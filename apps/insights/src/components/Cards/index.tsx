import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";

export const Cards = ({ className, ...props }: ComponentProps<"section">) => (
  <section className={clsx(className, styles.cards)} {...props} />
);
