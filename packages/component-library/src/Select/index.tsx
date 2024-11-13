import clsx from "clsx";
import { type ComponentProps, type ReactNode, useCallback } from "react";
import {
  type PopoverProps,
  Label,
  Select as BaseSelect,
  Popover,
  ListBox,
  ListBoxItem,
} from "react-aria-components";

import { Button } from "../Button/index.js";

type Props<T> = Omit<
  ComponentProps<typeof BaseSelect>,
  "selectedKey" | "onSelectionChange"
> & {
  selectedKey: T;
  onSelectionChange: (newValue: T) => void;
  options: readonly T[];
  show?: (value: T) => string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  rounded?: ComponentProps<typeof Button>["rounded"];
  hideText?: ComponentProps<typeof Button>["hideText"];
  beforeIcon?: ComponentProps<typeof Button>["beforeIcon"];
  placement?: PopoverProps["placement"] | undefined;
  label: ReactNode;
  hideLabel?: boolean | undefined;
};

export const Select = <T extends string | number>({
  options,
  show,
  selectedKey,
  onSelectionChange,
  variant,
  size,
  rounded,
  hideText,
  beforeIcon,
  label,
  hideLabel,
  placement,
  ...props
}: Props<T>) => {
  const handleSelectionChange = useCallback(
    (newKey: T) => {
      if (newKey !== selectedKey) {
        onSelectionChange(newKey);
      }
    },
    [onSelectionChange, selectedKey],
  );
  return (
    <BaseSelect
      selectedKey={selectedKey}
      // @ts-expect-error react-aria coerces everything to Key for some reason...
      onSelectionChange={handleSelectionChange}
      {...props}
    >
      <Label className={clsx({ "sr-only": hideLabel })}>{label}</Label>
      <Button
        afterIcon={DropdownCaretDown}
        variant={variant}
        size={size}
        rounded={rounded}
        hideText={hideText}
        beforeIcon={beforeIcon}
      >
        {show?.(selectedKey) ?? selectedKey.toString()}
      </Button>
      <Popover
        {...(placement && { placement })}
        className="min-w-[--trigger-width] bg-white data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:fade-in data-[exiting]:fade-out dark:bg-steel-950"
      >
        <ListBox
          className="bg-pythpurple-100 text-pythpurple-950 flex origin-top-right flex-col rounded border border-neutral-400 py-1 text-sm shadow shadow-neutral-400 outline-none"
          items={options.map((id) => ({ id }))}
        >
          {({ id }) => (
            <ListBoxItem className="cursor-pointer whitespace-nowrap px-2 py-1 text-xs outline-none data-[disabled]:cursor-default data-[selected]:cursor-default data-[focused]:bg-black/10 data-[selected]:data-[focused]:bg-transparent data-[selected]:font-bold dark:data-[focused]:bg-white/10">
              {show?.(id) ?? id}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </BaseSelect>
  );
};

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
