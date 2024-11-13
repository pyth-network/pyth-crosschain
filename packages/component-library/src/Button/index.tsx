import clsx from "clsx";
import type { ComponentType, ReactNode } from "react";
import {
  type ButtonProps as BaseButtonProps,
  type LinkProps as BaseLinkProps,
} from "react-aria-components";

import { UnstyledButton } from "../UnstyledButton/index.js";
import { UnstyledLink } from "../UnstyledLink/index.js";

export const VARIANTS = [
  "primary",
  "secondary",
  "solid",
  "outline",
  "ghost",
  "success",
  "danger",
] as const;
export const SIZES = ["xs", "sm", "md", "lg"] as const;

type OwnProps = {
  variant?: (typeof VARIANTS)[number] | undefined;
  size?: (typeof SIZES)[number] | undefined;
  rounded?: boolean | undefined;
  hideText?: boolean | undefined;
  children: string;
  beforeIcon?: Icon | undefined;
  afterIcon?: Icon | undefined;
};

export type ButtonProps = Omit<BaseButtonProps, keyof OwnProps> & OwnProps;

export const Button = ({ className, ...props }: ButtonProps) => (
  <ButtonImpl
    component={UnstyledButton}
    className={clsx(
      // Pending
      "data-[pending]:data-[variant]:cursor-wait data-[pending]:data-[variant]:border-transparent data-[pending]:data-[variant]:bg-stone-200 data-[pending]:data-[variant]:text-stone-400 data-[pending]:data-[variant]:data-[focus-visible]:outline-stone-300 dark:data-[pending]:data-[variant]:bg-steel-600 dark:data-[pending]:data-[variant]:text-steel-400 dark:data-[pending]:data-[variant]:outline-steel-500",

      className,
    )}
    {...props}
  />
);

export type ButtonLinkProps = Omit<BaseLinkProps, keyof OwnProps> & OwnProps;

export const ButtonLink = (props: ButtonLinkProps) => (
  <ButtonImpl component={UnstyledLink} {...props} />
);

type ButtonImplProps = OwnProps & {
  className?: Parameters<typeof clsx>[0];
  component: ComponentType<{
    className: ReturnType<typeof clsx>;
    children: ReactNode[];
  }>;
};

const ButtonImpl = ({
  component: Component,
  variant = "primary",
  size = "md",
  rounded = false,
  className,
  children,
  beforeIcon,
  afterIcon,
  hideText = false,
  ...inputProps
}: ButtonImplProps) => (
  <Component
    {...inputProps}
    data-variant={variant}
    data-size={size}
    data-rounded={rounded ? "" : undefined}
    data-text-hidden={hideText ? "" : undefined}
    className={clsx(baseClasses, className)}
  >
    {beforeIcon !== undefined && <Icon icon={beforeIcon} />}
    <span className="group-data-[text-hidden]/button:sr-only group-data-[size=lg]/button:px-3 group-data-[size=md]/button:px-2 group-data-[size=sm]/button:px-2 group-data-[size=xs]/button:px-1 group-data-[size=lg]/button:leading-[3.5rem] group-data-[size=md]/button:leading-[3rem] group-data-[size=sm]/button:leading-9 group-data-[size=xs]/button:leading-6">
      {children}
    </span>
    {afterIcon !== undefined && <Icon icon={afterIcon} />}
  </Component>
);

const Icon = ({ icon: IconComponent }: { icon: Icon }) => (
  <span className="inline-grid h-full place-content-center align-top">
    <IconComponent className="relative group-data-[size=lg]/button:size-6 group-data-[size=md]/button:size-6 group-data-[size=sm]/button:size-5 group-data-[size=xs]/button:size-4" />
  </span>
);

const baseClasses = clsx(
  "group/button inline-block cursor-pointer whitespace-nowrap font-medium outline-none outline-0 transition-colors duration-100 data-[size]:data-[rounded]:rounded-full data-[focus-visible]:outline-2",

  // xs
  "data-[size=xs]:h-6 data-[size=xs]:rounded-md data-[size=xs]:px-button-padding-xs data-[size=xs]:text-[0.6875rem]",

  // sm
  "data-[size=sm]:h-9 data-[size=sm]:rounded-lg data-[size=sm]:px-button-padding-sm data-[size=sm]:text-sm",

  // md (default)
  "data-[size=md]:h-12 data-[size=md]:rounded-xl data-[size=md]:px-3 data-[size=md]:text-base",

  // lg
  "data-[size=lg]:h-14 data-[size=lg]:rounded-2xl data-[size=lg]:px-4 data-[size=lg]:text-xl",

  // Primary (default)
  "data-[variant=primary]:bg-violet-700 data-[variant=primary]:data-[hovered]:bg-violet-800 data-[variant=primary]:data-[pressed]:bg-violet-900 data-[variant=primary]:text-white data-[variant=primary]:outline-violet-700",

  // Dark Mode Primary (default)
  "dark:data-[variant=primary]:bg-violet-600 dark:data-[variant=primary]:data-[hovered]:bg-violet-700 dark:data-[variant=primary]:data-[pressed]:bg-violet-800 dark:data-[variant=primary]:text-white dark:data-[variant=primary]:outline-violet-600",

  // Secondary
  "data-[variant=secondary]:bg-purple-200 data-[variant=secondary]:data-[hovered]:bg-purple-300 data-[variant=secondary]:data-[pressed]:bg-purple-400 data-[variant=secondary]:text-steel-900 data-[variant=secondary]:outline-purple-300",

  // Dark Mode Secondary
  "dark:data-[variant=secondary]:bg-purple-200 dark:data-[variant=secondary]:data-[hovered]:bg-purple-300 dark:data-[variant=secondary]:data-[pressed]:bg-purple-400 dark:data-[variant=secondary]:text-steel-900 dark:data-[variant=secondary]:outline-purple-300",

  // Solid
  "data-[variant=solid]:bg-steel-900 data-[variant=solid]:data-[hovered]:bg-steel-600 data-[variant=solid]:data-[pressed]:bg-steel-900 data-[variant=solid]:text-steel-50 data-[variant=solid]:outline-steel-600",

  // Dark Mode Solid
  "dark:data-[variant=solid]:bg-steel-50 dark:data-[variant=solid]:data-[hovered]:bg-steel-200 dark:data-[variant=solid]:data-[pressed]:bg-steel-50 dark:data-[variant=solid]:text-steel-900 dark:data-[variant=solid]:outline-steel-300",

  // Outline
  "data-[variant=outline]:border data-[variant=outline]:border-stone-300 data-[variant=outline]:bg-transparent data-[variant=outline]:data-[hovered]:bg-black/5 data-[variant=outline]:data-[pressed]:bg-black/10 data-[variant=outline]:text-stone-900 data-[variant=outline]:outline-steel-600",

  // Dark Mode Outline
  "dark:data-[variant=outline]:border-steel-600 dark:data-[variant=outline]:bg-transparent dark:data-[variant=outline]:data-[hovered]:bg-white/5 dark:data-[variant=outline]:data-[pressed]:bg-white/10 dark:data-[variant=outline]:text-steel-50 dark:data-[variant=outline]:outline-steel-300",

  // Ghost
  "data-[variant=ghost]:bg-transparent data-[variant=ghost]:data-[hovered]:bg-black/5 data-[variant=ghost]:data-[pressed]:bg-black/10 data-[variant=ghost]:text-stone-900 data-[variant=ghost]:outline-steel-600",

  // Dark Mode Ghost
  "dark:data-[variant=ghost]:bg-transparent dark:data-[variant=ghost]:data-[hovered]:bg-white/5 dark:data-[variant=ghost]:data-[pressed]:bg-white/10 dark:data-[variant=ghost]:text-steel-50 dark:data-[variant=ghost]:outline-steel-300",

  // Success
  "data-[variant=success]:bg-emerald-500 data-[variant=success]:data-[hovered]:bg-emerald-600 data-[variant=success]:data-[pressed]:bg-emerald-700 data-[variant=success]:text-violet-50 data-[variant=success]:outline-emerald-500",

  // Dark Mode Success
  "dark:data-[variant=success]:bg-emerald-500 dark:data-[variant=success]:data-[hovered]:bg-emerald-600 dark:data-[variant=success]:data-[pressed]:bg-emerald-700 dark:data-[variant=success]:text-violet-50 dark:data-[variant=success]:outline-emerald-500",

  // Danger
  "data-[variant=danger]:bg-red-500 data-[variant=danger]:data-[hovered]:bg-red-600 data-[variant=danger]:data-[pressed]:bg-red-700 data-[variant=danger]:text-violet-50 data-[variant=danger]:outline-red-500",

  // Dark Mode Danger
  "dark:data-[variant=danger]:bg-red-500 dark:data-[variant=danger]:data-[hovered]:bg-red-600 dark:data-[variant=danger]:data-[pressed]:bg-red-700 dark:data-[variant=danger]:text-violet-50 dark:data-[variant=danger]:outline-red-500",

  // Disabled
  "data-[disabled]:data-[variant]:cursor-not-allowed data-[disabled]:data-[variant]:border-transparent data-[disabled]:data-[variant]:bg-stone-200 data-[disabled]:data-[variant]:text-stone-400 dark:data-[disabled]:data-[variant]:bg-steel-600 dark:data-[disabled]:data-[variant]:text-steel-400",
);

type Icon = ComponentType<{ className: string }>;
