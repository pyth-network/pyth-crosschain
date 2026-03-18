import clsx from "clsx";
import { motion } from "motion/react";
import type { ComponentProps } from "react";
import { Switch as UnstyledSwitch } from "../unstyled/Switch/index.jsx";
import styles from "./index.module.scss";

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
    data-pending={isPending ? "" : undefined}
    isDisabled={isDisabled === true || isPending === true}
    {...props}
  >
    {(args) => (
      <>
        <div className={styles.indicator}>
          <motion.div
            className={styles.dot}
            layout
            transition={{
              damping: 20,
              stiffness: 500,
              type: "spring",
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
