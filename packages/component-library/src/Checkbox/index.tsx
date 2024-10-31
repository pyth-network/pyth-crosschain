import clsx from "clsx";
import {
  Checkbox as BaseCheckbox,
  type CheckboxProps,
} from "react-aria-components";

export const Checkbox = ({ children, className, ...props }: CheckboxProps) => (
  <BaseCheckbox
    className={clsx(
      "group/checkbox inline-flex cursor-pointer flex-row gap-2 py-1 text-sm data-[disabled]:cursor-not-allowed",
      className,
    )}
    {...props}
  >
    {(args) => (
      <>
        <div className="relative top-[0.0625rem] mx-1 size-4 flex-none">
          <div className="size-full rounded border border-stone-300 bg-white outline-4 outline-violet-500/40 transition duration-100 group-data-[hovered]/checkbox:border-2 group-data-[disabled]/checkbox:border-none group-data-[hovered]/checkbox:border-stone-400 group-data-[pressed]/checkbox:border-stone-500 group-data-[disabled]/checkbox:bg-stone-200 group-data-[focus-visible]/checkbox:outline dark:border-steel-700 dark:bg-steel-800 dark:group-data-[hovered]/checkbox:border-steel-600 dark:group-data-[pressed]/checkbox:border-steel-500 dark:group-data-[disabled]/checkbox:bg-steel-600" />
          <div className="absolute inset-0 grid place-content-center rounded bg-violet-500 stroke-white p-1 opacity-0 transition duration-100 group-data-[disabled]/checkbox:bg-transparent group-data-[disabled]/checkbox:stroke-stone-400 group-data-[selected]/checkbox:opacity-100 dark:bg-violet-600 dark:stroke-steel-950 dark:group-data-[disabled]/checkbox:stroke-steel-400">
            <svg
              className="w-full"
              viewBox="0 0 8 6"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 3L2.76471 5L7 1"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="pointer-events-none absolute -inset-1.5 -z-10 rounded-full bg-black/20 opacity-0 transition duration-100 group-data-[focus-visible]/checkbox:opacity-0 group-data-[hovered]/checkbox:opacity-50 group-data-[pressed]/checkbox:opacity-100 dark:bg-white/20" />
        </div>
        {typeof children === "function" ? children(args) : children}
      </>
    )}
  </BaseCheckbox>
);
