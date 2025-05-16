"use client";

import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { House } from "@phosphor-icons/react/dist/ssr/House";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

import styles from "./index.module.scss";
import { Button } from "../Button/index.jsx";
import { Link } from "../Link/index.jsx";
import {
  Breadcrumbs as UnstyledBreadcrumbs,
  Breadcrumb,
} from "../unstyled/Breadcrumbs/index.jsx";

type OwnProps = {
  label: string;
  items: [
    ...{
      href: string;
      label: string;
    }[],
    { label: ReactNode },
  ];
};
type Props = Omit<ComponentProps<typeof UnstyledBreadcrumbs>, keyof OwnProps> &
  OwnProps;

export const Breadcrumbs = ({ label, className, items, ...props }: Props) => (
  <nav aria-label={label}>
    <UnstyledBreadcrumbs
      className={clsx(styles.breadcrumbs, className)}
      items={items.map((item, i) => ({ id: i, ...item }))}
      {...props}
    >
      {(item) => (
        <Breadcrumb className={styles.breadcrumb ?? ""}>
          {"href" in item ? (
            <>
              {item.href === "/" ? (
                <Button
                  size="xs"
                  variant="outline"
                  beforeIcon={<House />}
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
        </Breadcrumb>
      )}
    </UnstyledBreadcrumbs>
  </nav>
);
