"use client";

import cx from "clsx";
import { useEffect, useRef } from "react";

import { classes } from "./component.styles";
import type { LeftNavProps } from "./types";
import { PythLogo } from "../../svg/PythLogo";

export function LeftNav({
  children,
  className,
  onOpenChange,
  open = true,
}: LeftNavProps) {
  /** refs */
  const onOpenChangeRef = useRef(onOpenChange);

  /** effects */
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  // eslint-disable-next-line no-console
  console.info("onOpenChangeRef.current", onOpenChangeRef.current);

  return (
    <nav className={cx(classes.root, className)} data-open={open}>
      <div className={classes.top}>
        <div className={classes.logoWrapper}>
          <PythLogo />
        </div>
      </div>
      <div className={classes.navLinks}>{children}</div>
    </nav>
  );
}
