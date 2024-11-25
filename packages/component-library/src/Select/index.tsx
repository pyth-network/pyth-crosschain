import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import {
  type PopoverProps,
  Label,
  Select as BaseSelect,
  Popover,
  ListBox,
  ListBoxItem,
  SelectValue,
} from "react-aria-components";

import styles from "./index.module.scss";
import { Button } from "../Button/index.js";

type Props<T> = Omit<
  ComponentProps<typeof BaseSelect>,
  "defaultSelectedKey" | "selectedKey" | "onSelectionChange"
> &
  Pick<
    ComponentProps<typeof Button>,
    "variant" | "size" | "rounded" | "hideText" | "isPending"
  > &
  Pick<PopoverProps, "placement"> & {
    options: readonly T[];
    show?: (value: T) => string;
    icon?: ComponentProps<typeof Button>["beforeIcon"];
    label: ReactNode;
    hideLabel?: boolean | undefined;
  } & (
    | {
        defaultSelectedKey: T;
      }
    | {
        selectedKey: T;
        onSelectionChange: (newValue: T) => void;
      }
  );

export const Select = <T extends string | number>({
  className,
  options,
  show,
  variant,
  size,
  rounded,
  hideText,
  icon,
  label,
  hideLabel,
  placement,
  isPending,
  ...props
}: Props<T>) => (
  // @ts-expect-error react-aria coerces everything to Key for some reason...
  <BaseSelect
    className={clsx(styles.select, className)}
    data-label-hidden={hideLabel ? "" : undefined}
    {...("selectedKey" in props && { selectedKey: props.selectedKey })}
    {...props}
  >
    <Label className={styles.label}>{label}</Label>
    <Button
      afterIcon={({ className }) => (
        <DropdownCaretDown className={clsx(styles.caret, className)} />
      )}
      variant={variant}
      size={size}
      rounded={rounded}
      hideText={hideText}
      beforeIcon={icon}
      isPending={isPending === true}
    >
      <SelectValue<{ id: T }>>
        {({ selectedItem }) =>
          selectedItem ? (show?.(selectedItem.id) ?? selectedItem.id) : <></>
        }
      </SelectValue>
    </Button>
    <Popover {...(placement && { placement })} className={styles.popover ?? ""}>
      <ListBox
        className={styles.listbox ?? ""}
        items={options.map((id) => ({ id }))}
      >
        {({ id }) => (
          <ListBoxItem
            className={styles.listboxItem ?? ""}
            textValue={show?.(id) ?? id.toString()}
          >
            <span>{show?.(id) ?? id}</span>
            <Check weight="bold" className={styles.check} />
          </ListBoxItem>
        )}
      </ListBox>
    </Popover>
  </BaseSelect>
);

const DropdownCaretDown = (
  props: Omit<ComponentProps<"svg">, "xmlns" | "viewBox" | "fill">,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    {...props}
  >
    <path d="m13.346 9.284-3.125 3.125a.311.311 0 0 1-.442 0L6.654 9.284a.312.312 0 0 1 .221-.534h6.25a.312.312 0 0 1 .221.534Z" />
  </svg>
);
