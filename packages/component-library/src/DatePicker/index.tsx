/* eslint-disable unicorn/no-null */
"use client";

import {
  getLocalTimeZone,
  parseDate,
  parseDateTime,
} from "@internationalized/date";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";
import cx from "clsx";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef } from "react";
import type { DateValue } from "react-aria-components";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DatePicker as BaseDatePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Label,
  Popover,
} from "react-aria-components";

import type { InputProps } from "../Input";
import styles from "./index.module.scss";

export type DatePickerProps = Pick<
  InputProps,
  "max" | "min" | "placeholder"
> & {
  /**
   * css class name overrides
   */
  className?: string;

  /**
   * optional label to display above the input
   */
  label?: ReactNode;

  /**
   * fired whenever a user changes the selected date value
   */
  onChange: (dateStr: string) => void;

  /**
   * the currently-selected value, as a valid ISO-8061 date string
   */
  value: string;

  /**
   * which type of datepicker to display to the user
   *
   * @defaultValue 'date'
   */
  type?: "date" | "datetime";
};

/**
 * A datepicker that uses react-aria-components for keyboard support and theming.
 */
export function DatePicker({
  className,
  label,
  onChange,
  placeholder = "Select a date",
  value,
  type = "date",
  ...rest
}: DatePickerProps) {
  /** refs */
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  /** callbacks */
  const handleShowPickerOnClickOrFocus = useCallback(() => {
    const { current: triggerBtn } = triggerButtonRef;
    if (!triggerBtn) return;

    // force the picker open
    triggerBtn.click();
  }, []);

  /** memos */
  const valueToUse = useMemo(() => parseDateValue(value, type), [type, value]);

  const minValue = useMemo(
    () => parseDateValue(String(rest.min ?? ""), type),
    [type, rest.min],
  );

  const maxValue = useMemo(
    () => parseDateValue(String(rest.max ?? ""), type),
    [type, rest.max],
  );

  const placeholderValue = useMemo(
    () => parseDateValue(placeholder, type),
    [placeholder, type],
  );

  return (
    <BaseDatePicker
      aria-label={placeholder}
      className={cx(styles.datePicker, className)}
      granularity={type === "datetime" ? "minute" : "day"}
      maxValue={maxValue}
      minValue={minValue}
      onChange={(newValue) => {
        if (!newValue) {
          return;
        }

        onChange(toIsoString(newValue, type));
      }}
      placeholderValue={placeholderValue}
      value={valueToUse}
    >
      {label && <Label className={styles.label}>{label}</Label>}
      <Group className={cx(styles.group)}>
        <DateInput
          className={cx(styles.input)}
          onClick={handleShowPickerOnClickOrFocus}
        >
          {(segment) => (
            <DateSegment className={cx(styles.segment)} segment={segment} />
          )}
        </DateInput>
        <Button
          aria-label="Open calendar"
          className={cx(styles.trigger)}
          ref={triggerButtonRef}
        >
          <CalendarBlank className={styles.triggerIcon} />
        </Button>
      </Group>
      <Popover className={cx(styles.popover)}>
        <Dialog className={cx(styles.dialog)}>
          <Calendar className={cx(styles.calendar)}>
            <div className={cx(styles.calendarHeader)}>
              <Button slot="previous" className={cx(styles.navButton)}>
                <CaretLeft className={styles.navIcon} />
              </Button>
              <Heading className={styles.heading} />
              <Button slot="next" className={cx(styles.navButton)}>
                <CaretRight className={styles.navIcon} />
              </Button>
            </div>
            <CalendarGrid className={cx(styles.calendarGrid)}>
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className={cx(styles.headerCell)}>
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => (
                  <CalendarCell className={cx(styles.cell)} date={date} />
                )}
              </CalendarGridBody>
            </CalendarGrid>
          </Calendar>
        </Dialog>
      </Popover>
    </BaseDatePicker>
  );
}

function parseDateValue(
  value: string,
  type: "date" | "datetime",
): DateValue | null {
  const parsed = dayjs(value);
  if (!parsed.isValid()) {
    return null;
  }

  if (type === "datetime") {
    return parseDateTime(parsed.format("YYYY-MM-DDTHH:mm"));
  }

  return parseDate(parsed.format("YYYY-MM-DD"));
}

function toIsoString(
  value: Nullish<DateValue>,
  type: "date" | "datetime",
): string {
  if (isNullOrUndefined(value)) return "";

  if (type === "date") {
    const { year, month, day } = value;
    return new Date(Date.UTC(year, month - 1, day)).toISOString();
  }

  return value.toDate(getLocalTimeZone()).toISOString();
}
