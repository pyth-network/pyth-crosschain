import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

import { UnstyledToolbar } from "../UnstyledToolbar/index.js";

type Props = ComponentProps<"div"> & {
  header: ReactNode | ReactNode[];
  children: ReactNode | ReactNode[];
  full?: boolean;
} & (
    | { toolbar?: undefined }
    | { toolbar: ReactNode | ReactNode[]; toolbarLabel: string }
  );

export const Card = ({ header, children, full, ...props }: Props) => (
  <div className="rounded-2xl border border-stone-300 dark:border-steel-600">
    <div className="flex w-full flex-row items-center justify-between overflow-hidden rounded-t-2xl bg-beige-100 p-4 dark:bg-steel-900">
      <h2 className="text-lg font-medium">{header}</h2>
      {props.toolbar && (
        <UnstyledToolbar
          aria-label={props.toolbarLabel}
          className="flex flex-row gap-2"
        >
          {props.toolbar}
        </UnstyledToolbar>
      )}
    </div>
    <div
      className={clsx({
        "overflow-hidden rounded-b-2xl bg-beige-100 px-4 pb-4 dark:bg-steel-900":
          !full,
      })}
    >
      {children}
    </div>
  </div>
);
