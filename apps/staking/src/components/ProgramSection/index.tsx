import clsx from "clsx";
import type { HTMLAttributes, ComponentProps } from "react";

import { PositionFlowchart } from "../PositionFlowchart";

type Props = HTMLAttributes<HTMLElement> & {
  name: string;
  description: string;
  positions: ComponentProps<typeof PositionFlowchart>;
};

export const ProgramSection = ({
  className,
  name,
  description,
  children,
  positions,
  ...props
}: Props) => (
  <section
    className={clsx(
      "border border-neutral-600/50 bg-pythpurple-800 p-10",
      className,
    )}
    {...props}
  >
    <h2 className="text-3xl font-light">{name}</h2>
    <p>{description}</p>
    <PositionFlowchart
      {...positions}
      className={clsx(
        "mt-8 border border-neutral-600/50 bg-white/5 p-10",
        positions.className,
      )}
    />
    {children}
  </section>
);
