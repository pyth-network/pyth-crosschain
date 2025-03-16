import clsx from "clsx";
import type {
  ComponentProps,
  ReactNode,
  ComponentType,
  SVGAttributes,
} from "react";
import {
  Popover,
  Menu as BaseMenu,
  MenuItem as BaseMenuItem,
  MenuSection as BaseSection,
  Separator as BaseSeparator,
} from "react-aria-components";

type MenuProps<T extends object> = ComponentProps<typeof BaseMenu<T>> & {
  placement?: ComponentProps<typeof Popover>["placement"];
};

export const Menu = <T extends object>({
  className,
  placement,
  ...props
}: MenuProps<T>) => (
  <Popover
    className={clsx(
      "flex origin-top-right flex-col border border-neutral-400 bg-pythpurple-100 py-2 text-sm text-pythpurple-950 shadow shadow-neutral-400 data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:fade-in data-[exiting]:fade-out",
      className,
    )}
    {...(placement && { placement })}
  >
    <BaseMenu className="outline-none" {...props} />
  </Popover>
);

type MenuItemProps = Omit<ComponentProps<typeof BaseMenuItem>, "children"> & {
  icon?: ComponentType<SVGAttributes<SVGSVGElement>>;
  children: ReactNode;
};

export const MenuItem = ({
  children,
  icon: Icon,
  className,
  textValue,
  ...props
}: MenuItemProps) => (
  <BaseMenuItem
    textValue={textValue ?? (typeof children === "string" ? children : "")}
    className={clsx(
      "flex cursor-pointer items-center gap-2 whitespace-nowrap px-4 py-2 text-left outline-none data-[disabled]:cursor-default data-[focused]:bg-pythpurple-800/20 data-[has-submenu]:data-[open]:bg-pythpurple-800/10 data-[has-submenu]:data-[open]:data-[focused]:bg-pythpurple-800/20",
      className,
    )}
    {...props}
  >
    {Icon && <Icon className="size-4 text-pythpurple-600" />}
    {children}
  </BaseMenuItem>
);

export const Section = ({
  className,
  ...props
}: ComponentProps<typeof BaseSection>) => (
  <BaseSection className={clsx("flex w-full flex-col", className)} {...props} />
);

export const Separator = ({
  className,
  ...props
}: ComponentProps<typeof BaseSeparator>) => (
  <BaseSeparator
    className={clsx("mx-2 my-1 h-px bg-black/20", className)}
    {...props}
  />
);
