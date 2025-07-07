"use client";

import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import type { PopoverProps, Button as BaseButton } from "react-aria-components";
import {
  Label,
  Select as BaseSelect,
  Popover,
  Header,
  Collection,
  SelectValue,
} from "react-aria-components";

import styles from "./index.module.scss";
import type { Props as ButtonProps } from "../Button/index.jsx";
import { Button } from "../Button/index.jsx";
import { DropdownCaretDown } from "../DropdownCaretDown/index.jsx";
import {
  ListBox,
  ListBoxItem,
  ListBoxSection,
} from "../unstyled/ListBox/index.jsx";

export type Props<T extends { id: string | number }> = Omit<
  ComponentProps<typeof BaseSelect>,
  "defaultSelectedKey" | "selectedKey" | "onSelectionChange"
> &
  Pick<
    ButtonProps<typeof BaseButton>,
    "variant" | "size" | "rounded" | "hideText" | "isPending"
  > &
  Pick<PopoverProps, "placement"> & {
    show?: ((value: T) => ReactNode) | undefined;
    textValue?: ((value: T) => string) | undefined;
    icon?: ComponentProps<typeof Button>["beforeIcon"];
    label: ReactNode;
    hideLabel?: boolean | undefined;
    buttonLabel?: ReactNode;
    defaultButtonLabel?: ReactNode;
  } & (
    | {
        defaultSelectedKey?: T["id"] | undefined;
      }
    | {
        selectedKey: T["id"];
        onSelectionChange: (newValue: T["id"]) => void;
      }
  ) &
  (
    | {
        options: readonly T[];
      }
    | {
        hideGroupLabel?: boolean | undefined;
        optionGroups: {
          name: string;
          options: readonly T[];
          hideLabel?: boolean | undefined;
        }[];
      }
  );

export const Select = <T extends { id: string | number }>({
  className,
  show,
  textValue,
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
  defaultButtonLabel,
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
      afterIcon={<DropdownCaretDown className={styles.caret} />}
      variant={variant}
      size={size}
      rounded={rounded}
      hideText={hideText}
      beforeIcon={icon}
      isPending={isPending === true}
    >
      <ButtonLabel
        buttonLabel={buttonLabel}
        defaultButtonLabel={defaultButtonLabel}
        show={show}
      />
    </Button>
    <Popover
      {...(placement && { placement })}
      {...("optionGroups" in props && {
        "data-grouped": "",
        "data-group-label-hidden": props.hideGroupLabel ? "" : undefined,
      })}
      className={styles.popover ?? ""}
    >
      <span className={styles.title}>{label}</span>
      {"options" in props ? (
        <ListBox className={styles.listbox ?? ""} items={props.options}>
          {(item) => (
            <Item show={show} textValue={textValue}>
              {item}
            </Item>
          )}
        </ListBox>
      ) : (
        <ListBox className={styles.listbox ?? ""} items={props.optionGroups}>
          {({ name, options, hideLabel }) => (
            <ListBoxSection
              data-label-hidden={hideLabel ? "" : undefined}
              className={styles.section ?? ""}
              id={name}
            >
              <Header className={styles.groupLabel ?? ""}>{name}</Header>
              <Collection items={options}>
                {(item) => (
                  <Item show={show} textValue={textValue}>
                    {item}
                  </Item>
                )}
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
  show: ((value: T) => ReactNode) | undefined;
  textValue: ((value: T) => string) | undefined;
};

const Item = <T extends { id: string | number }>({
  children,
  show,
  textValue,
}: ItemProps<T>) => (
  <ListBoxItem
    id={typeof children === "object" ? children.id : children}
    className={styles.listboxItem ?? ""}
    textValue={getTextValue({ children, show, textValue })}
  >
    <span>{show?.(children) ?? children.id}</span>
    <Check weight="bold" className={styles.check} />
  </ListBoxItem>
);

const getTextValue = <T extends { id: string | number }>({
  children,
  show,
  textValue,
}: ItemProps<T>) => {
  if (textValue !== undefined) {
    return textValue(children);
  } else if (show === undefined) {
    return children.id.toString();
  } else {
    const result = show(children);
    return typeof result === "string" ? result : children.id.toString();
  }
};

type ButtonLabelProps<T extends { id: string | number }> = Pick<
  Props<T>,
  "buttonLabel" | "defaultButtonLabel" | "show"
>;

const ButtonLabel = <T extends { id: string | number }>({
  buttonLabel,
  defaultButtonLabel,
  show,
}: ButtonLabelProps<T>) => {
  if (buttonLabel !== undefined && buttonLabel !== "") {
    return buttonLabel;
  } else if (defaultButtonLabel !== undefined && defaultButtonLabel !== "") {
    return (
      <SelectValue<T>>
        {(props) =>
          props.selectedText === null ? (
            defaultButtonLabel
          ) : (
            <SelectedValueLabel show={show} {...props} />
          )
        }
      </SelectValue>
    );
  } else {
    return (
      <SelectValue<T>>
        {(props) => <SelectedValueLabel show={show} {...props} />}
      </SelectValue>
    );
  }
};

type SelectedValueLabelProps<T extends { id: string | number }> = Pick<
  Props<T>,
  "show"
> & {
  selectedItem: T | null;
  selectedText: string | null;
};

const SelectedValueLabel = <T extends { id: string | number }>({
  show,
  selectedItem,
  selectedText,
}: SelectedValueLabelProps<T>) =>
  selectedItem ? (show?.(selectedItem) ?? selectedItem.id) : selectedText;
