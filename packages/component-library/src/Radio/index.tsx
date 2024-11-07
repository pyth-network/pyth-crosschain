import clsx from "clsx";
import { Radio as BaseRadio, type RadioProps } from "react-aria-components";

export const Radio = ({ children, className, ...props }: RadioProps) => (
  <BaseRadio
    className={clsx(
      "group/radio inline-flex cursor-pointer flex-row gap-2 py-1 text-sm data-[disabled]:cursor-not-allowed data-[selected]:cursor-default",
      className,
    )}
    {...props}
  >
    {(args) => (
      <>
        <div className="relative top-[0.0625rem] mx-1 size-4 flex-none">
          <div className="size-full rounded-full border border-stone-300 bg-white outline-4 outline-violet-500/40 transition duration-100 group-data-[hovered]/radio:border-2 group-data-[disabled]/radio:border-none group-data-[hovered]/radio:border-stone-400 group-data-[pressed]/radio:border-stone-500 group-data-[disabled]/radio:bg-stone-200 group-data-[focus-visible]/radio:outline dark:border-steel-700 dark:bg-steel-800 dark:group-data-[hovered]/radio:border-steel-600 dark:group-data-[pressed]/radio:border-steel-500 dark:group-data-[disabled]/radio:bg-steel-600" />
          <div className="absolute inset-0 rounded-full border-[0.3rem] border-violet-500 bg-white opacity-0 transition duration-100 group-data-[disabled]/radio:border-transparent group-data-[disabled]/radio:bg-stone-400 group-data-[selected]/radio:opacity-100 dark:border-violet-600 dark:bg-steel-950 dark:group-data-[disabled]/radio:bg-steel-400" />
          <div className="pointer-events-none absolute -inset-1.5 -z-10 rounded-full bg-black/20 opacity-0 transition duration-100 group-data-[focus-visible]/radio:opacity-0 group-data-[hovered]/radio:opacity-50 group-data-[pressed]/radio:opacity-100 group-data-[selected]/radio:opacity-0 dark:bg-white/20" />
        </div>
        {typeof children === "function" ? children(args) : children}
      </>
    )}
  </BaseRadio>
);
