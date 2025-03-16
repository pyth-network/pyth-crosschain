import type { InputProps } from "@headlessui/react";
import {
  Field,
  Label,
  Description,
  Input as HeadlessUiInput,
} from "@headlessui/react";
import clsx from "clsx";
import type { Ref, ReactNode } from "react";
import { forwardRef } from "react";

import { ErrorTooltip } from "../ErrorTooltip";

type Props = InputProps & {
  label: ReactNode;
  description: ReactNode;
  required?: boolean | undefined;
  validationError?: string | undefined;
};

const InputImpl = (
  {
    label,
    description,
    className,
    required,
    invalid,
    validationError,
    ...props
  }: Props,
  ref: Ref<HTMLElement>,
) => (
  <Field className="flex flex-col gap-1">
    <Label className="ml-3 font-semibold text-neutral-600 dark:text-neutral-400">
      {label}
      {required && (
        <span className="ml-0.5 align-top text-sm text-red-500">*</span>
      )}
    </Label>
    <div className="relative h-12 w-full">
      <HeadlessUiInput
        ref={ref}
        invalid={invalid === true || validationError !== undefined}
        className={clsx(
          "flex size-full flex-row items-center justify-between truncate rounded border border-neutral-500 bg-transparent px-3 text-left text-sm placeholder:opacity-60 data-[focus]:border-pythpurple-600 data-[invalid]:border-red-500 data-[invalid]:data-[focus]:border-pythpurple-600 data-[invalid]:pl-3 data-[invalid]:pr-12 data-[focus]:ring-pythpurple-600 dark:data-[focus]:border-pythpurple-400 dark:data-[invalid]:border-red-600 dark:data-[invalid]:data-[focus]:border-pythpurple-400 dark:data-[focus]:ring-pythpurple-400",
          className,
        )}
        {...props}
      />
      {validationError && (
        <ErrorTooltip className="absolute right-3 top-3 h-6">
          {validationError}
        </ErrorTooltip>
      )}
    </div>
    <Description className="mx-3 text-xs font-light text-neutral-600 dark:text-neutral-400">
      {description}
    </Description>
  </Field>
);

export const Input = forwardRef(InputImpl);
