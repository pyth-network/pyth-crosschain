import {
  Field,
  Label,
  Description,
  Input as HeadlessUiInput,
  type InputProps,
} from "@headlessui/react";
import { ExclamationCircleIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import type { ReactNode } from "react";

import { Tooltip } from "../Tooltip";

type Props = InputProps & {
  label: ReactNode;
  description: ReactNode;
  required?: boolean | undefined;
  validationError?: string | undefined;
};

export const Input = ({
  label,
  description,
  className,
  required,
  invalid,
  validationError,
  ...props
}: Props) => (
  <Field className="flex flex-col gap-1">
    <Label className="ml-3 font-semibold text-neutral-600 dark:text-neutral-400">
      {label}
      {required && (
        <span className="ml-0.5 align-top text-sm text-red-500">*</span>
      )}
    </Label>
    <div className="relative h-12 w-full">
      <HeadlessUiInput
        invalid={invalid === true || validationError !== undefined}
        className={clsx(
          "flex size-full flex-row items-center justify-between truncate rounded border border-neutral-500 bg-transparent px-3 text-left text-sm placeholder:opacity-60 data-[focus]:border-pythpurple-600 data-[invalid]:border-red-500 data-[invalid]:data-[focus]:border-pythpurple-600 data-[invalid]:pl-3 data-[invalid]:pr-12 data-[focus]:ring-pythpurple-600 dark:data-[focus]:border-pythpurple-400 dark:data-[invalid]:border-red-600 dark:data-[invalid]:data-[focus]:border-pythpurple-400 dark:data-[focus]:ring-pythpurple-400",
          className,
        )}
        {...props}
      />
      {validationError && (
        <Tooltip arrow={{ width: 6, height: 10 }} gap={0} placement="top-end">
          <Tooltip.Trigger
            as={ExclamationCircleIcon}
            className="absolute right-3 top-3 h-6 text-red-500 dark:text-red-700"
          />
          <Tooltip.Content className="z-50 whitespace-pre-line rounded-md border border-red-500 bg-red-50 px-3 py-2 text-red-800 shadow-md dark:border-red-900 dark:bg-red-950 dark:text-red-200 dark:shadow-white/5">
            <Tooltip.Arrow className="fill-red-500 dark:fill-red-700" />
            <div className="max-w-40 text-xs">{validationError}</div>
          </Tooltip.Content>
        </Tooltip>
      )}
    </div>
    <Description className="mx-3 text-xs font-light text-neutral-600 dark:text-neutral-400">
      {description}
    </Description>
  </Field>
);
