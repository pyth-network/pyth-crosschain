import { Select as BaseSelect } from "@base-ui/react/select";
import cx from "clsx";
import type { ComponentProps, ReactNode } from "react";

import { classes } from "./Select.styles";
import type { SelectItem, SelectProps } from "./types";

function ChevronDownIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      fill="none"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="1em"
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      fill="none"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="1em"
      {...props}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function Select<
  Value = string,
  Multiple extends boolean | undefined = false,
>({
  items,
  placeholder,
  fullWidth = false,
  triggerClassName,
  popupClassName,
  ...rest
}: SelectProps<Value, Multiple>) {
  return (
    <BaseSelect.Root
      {...rest}
      items={items as { label: ReactNode; value: Value }[]}
    >
      <BaseSelect.Trigger
        className={cx(classes.trigger, triggerClassName)}
        data-fullwidth={fullWidth}
      >
        <BaseSelect.Value className={classes.value} placeholder={placeholder} />
        <BaseSelect.Icon className={classes.icon}>
          <ChevronDownIcon />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner className={classes.positioner} sideOffset={4}>
          <BaseSelect.Popup className={cx(classes.popup, popupClassName)}>
            <BaseSelect.ScrollUpArrow className={classes.scrollArrow}>
              <ChevronDownIcon style={{ transform: "rotate(180deg)" }} />
            </BaseSelect.ScrollUpArrow>
            <BaseSelect.List className={classes.list}>
              {items.map((item) => (
                <SelectItemComponent
                  key={String(item.value)}
                  item={item as SelectItem<unknown>}
                />
              ))}
            </BaseSelect.List>
            <BaseSelect.ScrollDownArrow className={classes.scrollArrow}>
              <ChevronDownIcon />
            </BaseSelect.ScrollDownArrow>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

function SelectItemComponent<T>({ item }: { item: SelectItem<T> }) {
  return (
    <BaseSelect.Item className={classes.item} value={item.value}>
      <BaseSelect.ItemIndicator className={classes.itemIndicator}>
        <CheckIcon />
      </BaseSelect.ItemIndicator>
      <BaseSelect.ItemText className={classes.itemText}>
        {item.label}
      </BaseSelect.ItemText>
    </BaseSelect.Item>
  );
}

export { type SelectProps, type SelectItem } from "./types";
