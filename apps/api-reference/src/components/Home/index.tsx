import Link from "next/link";
import type { ElementType, SVGProps } from "react";

import Benchmarks from "./benchmarks.svg";
import Entropy from "./entropy.svg";
import PriceFeeds from "./price-feeds.svg";
import { Button } from "../Button";
import { MaxWidth } from "../MaxWidth";

export const Home = () => (
  <main className="grid size-full place-content-center py-16 text-center">
    <h1 className="mb-16 text-4xl font-semibold text-pythpurple-600 dark:text-pythpurple-400">
      Pyth Network API Reference
    </h1>
    <MaxWidth>
      <nav
        className="flex flex-col items-stretch justify-center gap-12"
        aria-label="Products"
      >
        <ul className="contents">
          <li className="contents">
            <ProductLink
              icon={PriceFeeds}
              href="/price-feeds/evm/getPriceNoOlderThan"
              name="Price Feeds"
            >
              Fetch real-time low-latency market data, on 50+ chains or off
              chain
            </ProductLink>
          </li>
          <li className="contents">
            <ProductLink
              icon={Benchmarks}
              href="https://benchmarks.pyth.network/docs#/"
              target="_blank"
              name="Benchmarks"
            >
              Get historical market data from any Pyth feed for use in both on-
              and off-chain applications
            </ProductLink>
          </li>
          <li className="contents">
            <ProductLink icon={Entropy} href="/entropy" name="Entropy">
              Quickly and easily generate secure random numbers on the
              blockchain
            </ProductLink>
          </li>
        </ul>
      </nav>
    </MaxWidth>
  </main>
);

type ProductLinkProps = {
  name: string;
  href: string;
  target?: "_blank" | "_self";
  children: string;
  icon: ElementType<SVGProps<SVGSVGElement>>;
};

const ProductLink = ({
  name,
  children,
  href,
  target,
  icon: Icon,
}: ProductLinkProps) => (
  <Button
    as={Link}
    href={href}
    target={target}
    gradient
    className="flex max-w-2xl flex-col items-center gap-2 p-6 text-center sm:flex-row sm:gap-6 sm:pr-12 sm:text-left"
  >
    <Icon className="h-24 p-3 text-pythpurple-600 dark:text-pythpurple-400" />
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-medium text-pythpurple-600 dark:text-pythpurple-400">
        {name}
      </h2>
      <p className="text-lg font-normal text-neutral-600 dark:text-neutral-400">
        {children}
      </p>
    </div>
  </Button>
);
