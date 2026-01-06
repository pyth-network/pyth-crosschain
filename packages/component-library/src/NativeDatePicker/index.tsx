import cx from "clsx";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useId, useMemo } from "react";

import type { InputProps } from "../Input";
import { Input } from "../Input";

type NativeDatePickerProps = Pick<InputProps, "max" | "min" | "placeholder"> & {
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
 * A datepicker that uses the browser's native
 * <input type="date" /> element, with some
 * minor styling tweaks
 */
export function NativeDatePicker({
  className,
  label,
  onChange,
  value,
  type,
  ...rest
}: NativeDatePickerProps) {
  /** hooks */
  const inputId = useId();

  /** memos */
  const valueToUse = useMemo(() => {
    const d = dayjs(value);
    // the native datepicker requires a specific yyyy-mm-dd format,
    // as it does not deal with times, so we prep the value here.
    // the timepicker requires a format like 2018-06-07T00:00
    return d.format(type === "date" ? "YYYY-MM-DD" : "YYYY-MM-DDTHH:mm");
  }, [type, value]);

  return (
    <div className={cx(className)}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <Input
        {...rest}
        id={inputId}
        onChange={(e) => {
          const {
            currentTarget: { value },
          } = e;

          onChange(new Date(value).toISOString());
        }}
        type={type === "datetime" ? "datetime-local" : type}
        value={valueToUse}
      />
    </div>
  );
}
