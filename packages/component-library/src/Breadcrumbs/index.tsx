"use client";

import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { House } from "@phosphor-icons/react/dist/ssr/House";
import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";
import { Button } from "../Button/index.js";
import { Link } from "../Link/index.js";
import {
  UnstyledBreadcrumbs,
  UnstyledBreadcrumb,
} from "../UnstyledBreadcrumbs/index.js";

type OwnProps = {
  label: string;
  items: [
    ...{
      href: string;
      label: string;
    }[],
    { label: string },
  ];
};
type Props = Omit<ComponentProps<typeof UnstyledBreadcrumbs>, keyof OwnProps> &
  OwnProps;

export const Breadcrumbs = ({ label, className, items, ...props }: Props) => (
  <nav aria-label={label}>
    <UnstyledBreadcrumbs
      className={clsx(styles.breadcrumbs, className)}
      items={items.map((item) => ({
        id: "href" in item ? item.href : item.label,
        ...item,
      }))}
      {...props}
    >
      {(item) => (
        <UnstyledBreadcrumb className={styles.breadcrumb ?? ""}>
          {"href" in item ? (
            <>
              {item.href === "/" ? (
                <Button
                  size="xs"
                  variant="outline"
                  // I'm not quite sure why this is triggering, I'll need to
                  // figure this out later.  Something in Phosphor's types is
                  // incorrect and is making eslint think this icon is an error
                  // object somehow...
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  beforeIcon={House}
                  hideText
                  href="/"
                >
                  {item.label}
                </Button>
              ) : (
                <Link href={item.href} className={styles.crumb ?? ""} invert>
                  {item.label}
                </Link>
              )}
              <CaretRight className={styles.separator} />
            </>
          ) : (
            <div className={styles.current}>{item.label}</div>
          )}
        </UnstyledBreadcrumb>
      )}
    </UnstyledBreadcrumbs>
  </nav>
);
