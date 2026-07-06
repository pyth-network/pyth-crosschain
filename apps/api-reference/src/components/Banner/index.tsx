import { MaxWidth } from "../MaxWidth";

export const Banner = () => (
  <div className="w-full bg-pythpurple-100 text-pythpurple-950 dark:bg-pythpurple-600/20 dark:text-pythpurple-100">
    <MaxWidth className="flex min-h-8 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 py-1 text-center text-xs sm:text-sm">
      <span>
        This API reference is for{" "}
        <span className="font-semibold">Pyth Core</span>, not Pyth Pro.
      </span>
      <a
        className="font-semibold text-pythpurple-600 hover:underline dark:text-pythpurple-400"
        href="https://docs.pyth.network/price-feeds/pro"
        rel="noreferrer"
        target="_blank"
      >
        Pyth Pro docs →
      </a>
    </MaxWidth>
  </div>
);
