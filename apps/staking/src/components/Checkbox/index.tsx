import { CheckIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Checkbox as BaseCheckbox } from "react-aria-components";

type Props = Omit<ComponentProps<typeof BaseCheckbox>, "children"> & {
  children: ReactNode;
};

export const Checkbox = ({ className, children, ...props }: Props) => (
  <BaseCheckbox
    className={clsx("group flex cursor-pointer flex-row gap-2", className)}
    {...props}
  >
    <div className="relative top-1 size-4 flex-none rounded border border-pythpurple-400 transition duration-100 group-data-[selected]:bg-pythpurple-600">
      <CheckIcon className="absolute inset-0 stroke-2 opacity-0 transition duration-100 group-data-[selected]:opacity-100" />
    </div>
    <div>{children}</div>
  </BaseCheckbox>
);
