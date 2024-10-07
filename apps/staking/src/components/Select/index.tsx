import { ChevronDownIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import {
  Label,
  SelectValue,
  Select as BaseSelect,
  Popover,
  ListBox,
  ListBoxItem,
} from "react-aria-components";

import { Button } from "../Button";

type Props<T> = Omit<
  ComponentProps<typeof BaseSelect>,
  "selectedKey" | "onSelectionChange"
> & {
  label: ReactNode;
  selectedKey: T;
  onSelectionChange: (newValue: T) => void;
  options: readonly T[];
  show?: (value: T) => string;
};

export const Select = <T extends string | number>({
  className,
  options,
  show,
  selectedKey,
  onSelectionChange,
  label,
  ...props
}: Props<T>) => (
  <BaseSelect
    className={clsx("flex flex-row items-center gap-2", className)}
    selectedKey={selectedKey}
    // @ts-expect-error react-aria coerces everything to Key for some reason...
    onSelectionChange={onSelectionChange}
    {...props}
  >
    <Label className="whitespace-nowrap opacity-80">{label}</Label>
    <Button className="group px-2 py-3 text-xs transition sm:px-4" size="nopad">
      <SelectValue />
      <ChevronDownIcon className="size-4 flex-none opacity-60 transition duration-300 group-data-[pressed]:-rotate-180" />
    </Button>
    <Popover
      placement="bottom end"
      className="min-w-[--trigger-width] data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:fade-in data-[exiting]:fade-out"
    >
      <ListBox
        className="flex origin-top-right flex-col border border-neutral-400 bg-pythpurple-100 py-2 text-sm text-pythpurple-950 shadow shadow-neutral-400 outline-none"
        items={options.map((id) => ({ id }))}
      >
        {({ id }) => (
          <ListBoxItem className="flex cursor-pointer items-center gap-2 whitespace-nowrap px-4 py-2 text-left data-[disabled]:cursor-default data-[focused]:bg-pythpurple-800/20 data-[has-submenu]:data-[open]:bg-pythpurple-800/10 data-[has-submenu]:data-[open]:data-[focused]:bg-pythpurple-800/20 focus:outline-none focus-visible:outline-none">
            {show?.(id) ?? id}
          </ListBoxItem>
        )}
      </ListBox>
    </Popover>
  </BaseSelect>
);
