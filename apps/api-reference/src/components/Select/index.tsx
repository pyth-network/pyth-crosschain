import {
  Input,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import {
  ChevronDownIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { ReactNode, ChangeEvent } from "react";
import { useState, useCallback, useMemo } from "react";

import { Accordion, AccordionButton, AccordionPanel } from "../Accordion";

type Props<T> = {
  value: T;
  onChange: (newValue: T) => void;
  renderOption: (option: T) => ReactNode;
  renderButton?: (selected: T) => ReactNode;
  renderButtonContents?: (selected: T) => ReactNode;
  filter?: ((options: readonly T[], value: string) => readonly T[]) | undefined;
  className?: string | undefined;
} & (
  | {
      options: readonly T[];
    }
  | {
      optionGroups: { name: string; options: readonly T[] }[];
    }
);

export const Select = <T,>({
  value,
  onChange,
  renderOption,
  renderButton,
  renderButtonContents,
  filter,
  className,
  ...props
}: Props<T>) => {
  const [filterValue, setFilter] = useState("");
  const updateFilter = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      event.stopPropagation();
      setFilter(event.target.value);
    },
    [setFilter],
  );

  return (
    <Listbox
      value={value}
      onChange={onChange}
      as="div"
      className={clsx("relative", className)}
    >
      {renderButton ? (
        renderButton(value)
      ) : (
        <ListboxButton className="flex size-full flex-row items-center justify-between rounded border border-neutral-500 bg-neutral-100 px-3 py-1 text-left text-sm font-semibold hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700">
          {renderButtonContents ? (
            renderButtonContents(value)
          ) : (
            <div>{renderOption(value)}</div>
          )}
          <ChevronDownIcon className="h-3" />
        </ListboxButton>
      )}
      <div>
        <ListboxOptions
          className={clsx(
            "absolute right-0 top-full z-50 mt-1 min-w-[var(--button-width)] overflow-hidden rounded-lg border border-neutral-400 bg-neutral-100 text-sm font-medium shadow focus-visible:border-pythpurple-600 focus-visible:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:shadow-white/20 dark:focus-visible:border-pythpurple-400",
            { "py-1": "options" in props },
          )}
        >
          <div className="max-h-80 overflow-y-auto">
            {filter && (
              <div className="sticky top-0 z-20 h-10 w-full bg-neutral-100 p-2 dark:bg-neutral-800">
                <Input
                  placeholder="Find a network"
                  className="peer size-full rounded bg-white pl-6 pr-2 text-sm transition-colors focus-visible:border-pythpurple-600 focus-visible:ring-transparent dark:bg-neutral-900 dark:focus-visible:border-pythpurple-400"
                  value={filterValue}
                  onChange={updateFilter}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                />
                <div className="pointer-events-none absolute inset-y-0 left-4 grid place-content-center transition-colors peer-focus-visible:text-pythpurple-600 dark:peer-focus-visible:text-pythpurple-400">
                  <MagnifyingGlassIcon className="size-3" />
                </div>
              </div>
            )}
            {"options" in props ? (
              <Options
                options={
                  filter && filterValue !== ""
                    ? filter(props.options, filterValue)
                    : props.options
                }
                renderOption={renderOption}
              />
            ) : (
              props.optionGroups.map((group, i) => (
                <OptionGroup
                  key={i}
                  filter={filter}
                  filterValue={filterValue}
                  options={group.options}
                  name={group.name}
                  renderOption={renderOption}
                />
              ))
            )}
          </div>
        </ListboxOptions>
      </div>
    </Listbox>
  );
};

type OptionGroupProps<T> = {
  filter?: ((options: readonly T[], value: string) => readonly T[]) | undefined;
  filterValue: string;
  options: readonly T[];
  name: string;
  renderOption: (option: T) => ReactNode;
};

const OptionGroup = <T,>({
  filter,
  filterValue,
  options,
  name,
  renderOption,
}: OptionGroupProps<T>) => {
  const filteredOptions = useMemo(
    () =>
      filter && filterValue !== "" ? filter(options, filterValue) : options,
    [filter, filterValue, options],
  );

  return filteredOptions.length > 0 ? (
    <Accordion defaultOpen>
      <AccordionButton
        className={clsx(
          "group sticky z-10 flex w-full flex-row items-center gap-1 bg-neutral-200 px-2 py-1 text-left text-xs font-bold hover:bg-neutral-300 focus-visible:bg-neutral-300 focus-visible:outline-none dark:bg-neutral-600 dark:hover:bg-neutral-500 dark:focus-visible:bg-neutral-500",
          filter ? "top-10" : "top-0",
        )}
      >
        <ChevronRightIcon className="size-3 fill-pythpurple-950 transition-transform group-data-[open]:rotate-90 dark:fill-white" />
        <div>{name}</div>
      </AccordionButton>
      <AccordionPanel>
        <Options options={filteredOptions} renderOption={renderOption} />
      </AccordionPanel>
    </Accordion>
  ) : // eslint-disable-next-line unicorn/no-null
  null;
};

type OptionsProps<T> = {
  options: readonly T[];
  renderOption: (option: T) => ReactNode;
};

const Options = <T,>({ options, renderOption }: OptionsProps<T>) =>
  options.map((option, i) => (
    <ListboxOption
      key={i}
      value={option}
      className="group flex w-32 min-w-full cursor-pointer flex-row items-center gap-3 px-2 py-1 data-[focus]:bg-neutral-300 data-[selected]:text-pythpurple-600 dark:data-[focus]:bg-neutral-700 dark:data-[selected]:text-pythpurple-400"
    >
      {renderOption(option)}
    </ListboxOption>
  ));
