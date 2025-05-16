import clsx from "clsx";
import { motion } from "motion/react";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";
import { Switch as UnstyledSwitch } from "../unstyled/Switch/index.jsx";

type OwnProps = {
  isPending?: boolean | undefined;
};
type Props = Omit<ComponentProps<typeof UnstyledSwitch>, keyof OwnProps> &
  OwnProps;

export const Switch = ({
  children,
  className,
  isPending,
  isDisabled,
  ...props
}: Props) => (
  <UnstyledSwitch
    className={clsx(styles.switch, className)}
    isDisabled={isDisabled === true || isPending === true}
    data-pending={isPending ? "" : undefined}
    {...props}
  >
    {(args) => (
      <>
        <div className={styles.indicator}>
          <motion.div
            layout
            className={styles.dot}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 20,
            }}
          />
        </div>
        <div className={styles.label}>
          {typeof children === "function" ? children(args) : children}
        </div>
      </>
    )}
  </UnstyledSwitch>
);
