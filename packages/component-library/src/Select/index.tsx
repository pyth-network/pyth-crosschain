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
  ListBoxSection,
  Header,
  Collection,
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
    show?: (value: T) => string;
    icon?: ComponentProps<typeof Button>["beforeIcon"];
    label: ReactNode;
    hideLabel?: boolean | undefined;
    buttonLabel?: ReactNode;
  } & (
    | {
        defaultSelectedKey?: T | undefined;
      }
    | {
        selectedKey: T;
        onSelectionChange: (newValue: T) => void;
      }
  ) &
  (
    | {
        options: readonly T[];
      }
    | {
        hideGroupLabel?: boolean | undefined;
        optionGroups: { name: string; options: readonly T[] }[];
      }
  );

export const Select = <T extends string | number>({
  className,
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
  buttonLabel,
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
      {buttonLabel !== undefined && buttonLabel !== "" ? (
        buttonLabel
      ) : (
        <SelectValue<{ id: T }>>
          {({ selectedItem, selectedText }) =>
            selectedItem
              ? (show?.(selectedItem.id) ?? selectedItem.id)
              : selectedText
          }
        </SelectValue>
      )}
    </Button>
    <Popover
      {...(placement && { placement })}
      data-group-label-hidden={
        "hideGroupLabel" in props && props.hideGroupLabel ? "" : undefined
      }
      className={styles.popover ?? ""}
    >
      <span className={styles.title}>{label}</span>
      {"options" in props ? (
        <ListBox
          className={styles.listbox ?? ""}
          items={props.options.map((id) => ({ id }))}
        >
          {({ id }) => <Item show={show}>{id}</Item>}
        </ListBox>
      ) : (
        <ListBox className={styles.listbox ?? ""} items={props.optionGroups}>
          {({ name, options }) => (
            <ListBoxSection className={styles.section ?? ""} id={name}>
              <Header className={styles.groupLabel ?? ""}>{name}</Header>
              <Collection items={options.map((id) => ({ id }))}>
                {({ id }) => <Item show={show}>{id}</Item>}
              </Collection>
            </ListBoxSection>
          )}
        </ListBox>
      )}
    </Popover>
  </BaseSelect>
);

type ItemProps<T> = {
  children: T;
  show: ((value: T) => string) | undefined;
};

const Item = <T extends string | number>({ children, show }: ItemProps<T>) => (
  <ListBoxItem
    id={children}
    className={styles.listboxItem ?? ""}
    textValue={show?.(children) ?? children.toString()}
  >
    <span>{show?.(children) ?? children}</span>
    <Check weight="bold" className={styles.check} />
  </ListBoxItem>
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
