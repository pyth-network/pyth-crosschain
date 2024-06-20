import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

type Props<T> = {
  value: T;
  onChange: (newValue: T) => void;
  options: readonly T[];
  renderOption: (option: T) => ReactNode;
  renderButton?: (selected: T) => ReactNode;
  renderButtonContents?: (selected: T) => ReactNode;
  buttonClassName?: string | undefined;
  anchor?: ComponentProps<typeof ListboxOptions>["anchor"];
};

export const Select = <T,>({
  value,
  onChange,
  options,
  renderOption,
  renderButton,
  renderButtonContents,
  anchor,
  buttonClassName,
}: Props<T>) => (
  <Listbox value={value} onChange={onChange}>
    {renderButton ? (
      renderButton(value)
    ) : (
      <ListboxButton
        className={clsx(
          "flex flex-row items-center justify-between rounded border border-neutral-500 bg-neutral-100 px-3 py-1 text-left text-sm font-semibold hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700",
          buttonClassName,
        )}
      >
        <div>{(renderButtonContents ?? renderOption)(value)}</div>
        <ChevronDownIcon className="h-3" />
      </ListboxButton>
    )}
    <ListboxOptions
      anchor={getAnchor(anchor)}
      className="z-50 min-w-[var(--button-width)] rounded-lg border border-neutral-400 bg-neutral-100 py-1 text-sm font-medium shadow dark:border-neutral-600 dark:bg-neutral-800 dark:shadow-white/20"
    >
      {options.map((option, i) => (
        <ListboxOption
          key={i}
          value={option}
          className="group flex w-32 min-w-full cursor-pointer flex-row items-center gap-3 px-2 py-1 data-[focus]:bg-neutral-300 data-[selected]:text-pythpurple-600 dark:data-[focus]:bg-neutral-700 dark:data-[selected]:text-pythpurple-400"
        >
          {renderOption(option)}
        </ListboxOption>
      ))}
    </ListboxOptions>
  </Listbox>
);

const getAnchor = (
  anchor: ComponentProps<typeof ListboxOptions>["anchor"] | undefined,
) => {
  if (typeof anchor === "string") {
    return { to: anchor, gap: "0.25rem" };
  } else if (typeof anchor === "object") {
    return { gap: "0.25rem", ...anchor };
  } else {
    return { to: "bottom" as const, gap: "0.25rem" };
  }
};
