import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";

type Props = ComponentProps<"div">;

export const Card = ({ className, ...props }: Props) => (
  <div className={clsx(styles.card, className)} {...props} />
);
