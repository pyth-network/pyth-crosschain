"use client";

import type { IconProps } from "@phosphor-icons/react";
import { Desktop } from "@phosphor-icons/react/dist/ssr/Desktop";
import { Moon } from "@phosphor-icons/react/dist/ssr/Moon";
import { Sun } from "@phosphor-icons/react/dist/ssr/Sun";
import { Button } from "@pythnetwork/component-library/Button";
import clsx from "clsx";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import {
  type ComponentProps,
  useCallback,
  useRef,
  useMemo,
  type ComponentType,
} from "react";
import { useIsSSR } from "react-aria";

import styles from "./theme-switch.module.scss";

type Props = Omit<
  ComponentProps<typeof Button>,
  "beforeIcon" | "variant" | "size" | "hideText" | "children" | "onPress"
>;

export const ThemeSwitch = ({ className, ...props }: Props) => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = useCallback(() => {
    const nextThemeName = nextTheme(theme);
    setTheme(nextThemeName);
  }, [theme, setTheme]);

  return (
    <Button
      variant="ghost"
      size="sm"
      hideText
      onPress={toggleTheme}
      beforeIcon={IconPath}
      className={clsx(styles.themeSwitch, className)}
      rounded
      {...props}
    >
      Dark mode
    </Button>
  );
};

const IconPath = ({ className, ...props }: Omit<IconProps, "offset">) => {
  const offsets = useOffsets();
  const isSSR = useIsSSR();

  return isSSR ? (
    <div className={className} />
  ) : (
    <div className={clsx(styles.iconPath, className)}>
      <IconMovement icon={Desktop} offset={offsets.desktop} {...props} />
      <IconMovement icon={Sun} offset={offsets.sun} {...props} />
      <IconMovement icon={Moon} offset={offsets.moon} {...props} />
    </div>
  );
};

type IconMovementProps = Omit<IconProps, "offset"> & {
  icon: ComponentType<IconProps>;
  offset: string;
};

const IconMovement = ({ icon: Icon, offset, ...props }: IconMovementProps) => (
  <motion.div
    // @ts-expect-error Looks like framer-motion has a bug in it's typings...
    className={styles.iconMovement}
    animate={{ offsetDistance: offset }}
    transition={{ type: "spring", bounce: 0.35, duration: 0.6 }}
    initial={false}
  >
    <Icon className={styles.icon} {...props} />
  </motion.div>
);

const useOffsets = () => {
  const numRotations = useRef(1);
  const prevTheme = useRef<string | undefined>(undefined);
  const { theme } = useTheme();

  if (theme !== prevTheme.current) {
    prevTheme.current = theme;
    if (theme === "light") {
      numRotations.current += 1;
    }
  }

  return useMemo(() => {
    const calc = (offset: number) =>
      `${(100 * (numRotations.current + offset)).toString()}%`;

    switch (theme) {
      case "light": {
        return { desktop: calc(1 / 3), sun: calc(0), moon: calc(-1 / 3) };
      }
      case "dark": {
        return { desktop: calc(2 / 3), sun: calc(1 / 3), moon: calc(0) };
      }
      default: {
        return { desktop: calc(1), sun: calc(2 / 3), moon: calc(1 / 3) };
      }
    }
  }, [theme]);
};

const nextTheme = (theme: string | undefined) => {
  switch (theme) {
    case "system": {
      return "light";
    }
    case "light": {
      return "dark";
    }
    default: {
      return "system";
    }
  }
};
