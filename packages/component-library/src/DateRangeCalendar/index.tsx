"use client";

import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import clsx from "clsx";
import type { ComponentProps } from "react";
import {
  RangeCalendar,
  Heading,
  CalendarGrid,
  CalendarGridBody,
  CalendarCell,
} from "react-aria-components";

import styles from "./index.module.scss";
import { Button as UnstyledButton } from "../unstyled/Button/index.jsx";

type Props = Omit<
  ComponentProps<typeof RangeCalendar>,
  "children" | "visibleDuration"
>;

export const DateRangeCalendar = ({ className, ...props }: Props) => (
  <RangeCalendar
    className={clsx(styles.dateRangeCalendar, className)}
    visibleDuration={{ months: 2 }}
    {...props}
  >
    <header className={styles.header}>
      <UnstyledButton className={styles.navButton ?? ""} slot="previous">
        <CaretLeft weight="bold" />
      </UnstyledButton>
      <Heading className={styles.heading} />
      <UnstyledButton className={styles.navButton ?? ""} slot="next">
        <CaretRight weight="bold" />
      </UnstyledButton>
    </header>
    <div className={styles.calendars}>
      <CalendarGrid className={styles.calendar ?? ""}>
        <CalendarGridBody className={styles.calendarBody ?? ""}>
          {(date) => (
            <CalendarCell className={styles.cell ?? ""} date={date}>
              {({ formattedDate }) => (
                <div className={styles.cellContent}>{formattedDate}</div>
              )}
            </CalendarCell>
          )}
        </CalendarGridBody>
      </CalendarGrid>
      <CalendarGrid className={styles.calendar ?? ""} offset={{ months: 1 }}>
        <CalendarGridBody className={styles.calendarBody ?? ""}>
          {(date) => (
            <CalendarCell className={styles.cell ?? ""} date={date}>
              {({ formattedDate }) => (
                <div className={styles.cellContent}>{formattedDate}</div>
              )}
            </CalendarCell>
          )}
        </CalendarGridBody>
      </CalendarGrid>
    </div>
  </RangeCalendar>
);
