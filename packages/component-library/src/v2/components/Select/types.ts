import type { Select } from "@base-ui/react/select";
import type { ComponentProps, ReactNode } from "react";

export type SelectItem<T = string> = {
  label: ReactNode;
  value: T;
};

export type SelectProps<
  Value = string,
  Multiple extends boolean | undefined = false,
> = Omit<ComponentProps<typeof Select.Root<Value, Multiple>>, "items"> & {
  /**
   * Data structure of the items rendered in the select popup.
   */
  items: SelectItem<Value>[];

  /**
   * Placeholder text shown when no value is selected.
   */
  placeholder?: string;

  /**
   * If true, the select will take up 100% of the available width.
   *
   * @defaultValue false
   */
  fullWidth?: boolean;

  /**
   * Additional className for the trigger element.
   */
  triggerClassName?: string;

  /**
   * Additional className for the popup element.
   */
  popupClassName?: string;
};
