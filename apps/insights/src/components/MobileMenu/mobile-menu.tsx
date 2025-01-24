"use client";
import { List } from "@phosphor-icons/react/dist/ssr/List";
import { Button } from "@pythnetwork/component-library/Button";
import clsx from "clsx";
import { useState, type ComponentProps } from "react";

import styles from "./mobile-menu.module.scss";

export const MobileMenu = ({ className, ...props }: ComponentProps<"div">) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={clsx(styles.mobileMenuTrigger, className)} {...props}>
      <Button
        variant="ghost"
        size="sm"
        afterIcon={List}
        rounded
        onPress={toggleMenu}
      >
        Menu
      </Button>
    </div>
  );
};
