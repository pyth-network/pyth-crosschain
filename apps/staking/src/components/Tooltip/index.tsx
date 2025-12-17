import clsx from "clsx";
import type { ComponentProps } from "react";
import { OverlayArrow, Tooltip as TooltipImpl } from "react-aria-components";

type Props = Omit<ComponentProps<typeof TooltipImpl>, "children"> & {
  children: React.ReactNode;
};

export const Tooltip = ({ children, className, offset, ...props }: Props) => (
  <TooltipImpl
    className={clsx(
      "group border border-neutral-900 bg-neutral-200 px-2 py-1 text-sm text-neutral-900 shadow shadow-white/50 transition data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:fade-in data-[exiting]:fade-out data-[entering]:slide-in-from-bottom",
      className,
    )}
    offset={offset ?? 10}
    {...props}
  >
    <OverlayArrow>
      <svg
        width={8}
        height={8}
        viewBox="0 0 8 8"
        className="fill-neutral-200 group-data-[placement=bottom]:rotate-180"
      >
        <path d="M0 0 L4 4 L8 0" />
      </svg>
    </OverlayArrow>
    {children}
  </TooltipImpl>
);
