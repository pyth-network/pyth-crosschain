"use client";

import { Field, Label } from "@headlessui/react";
import clsx from "clsx";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { type HTMLAttributes, useState, type ComponentProps } from "react";

import { apis } from "../../apis";
import { Select } from "../Select";

type Chain = keyof typeof apis;
const CHAINS = Object.keys(apis) as Chain[];

const CHAIN_TO_NAME = {
  evm: "EVM",
  aptos: "Aptos",
  cosmwasm: "CosmWasm",
  offchain: "Off-Chain",
};

const MENU = Object.fromEntries(
  Object.entries(apis).map(([chain, methods]) => [
    chain,
    Object.keys(methods).map((method) => ({
      name: method,
      href: `/price-feeds/${chain}/${method}`,
    })),
  ]),
);

export const Sidebar = ({
  className,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "children">) => {
  const [chain, setChain] = useState<Chain>("evm");

  return (
    <>
      <aside
        className={clsx(
          "fixed inset-y-16 -ml-3 w-64 overflow-y-auto pr-4",
          className,
        )}
        {...props}
      >
        <Field className="sticky top-0 flex w-full flex-row items-center gap-2 bg-white pb-2 pl-3 pt-4 dark:bg-pythpurple-900">
          <Label className="text-sm font-bold">Chain</Label>
          <Select
            value={chain}
            onChange={setChain}
            options={CHAINS}
            anchor="bottom start"
            buttonClassName="grow"
            renderOption={(chain) => CHAIN_TO_NAME[chain]}
          />
        </Field>
        <nav
          className="flex flex-col pb-4 pl-1 pt-2 text-sm text-neutral-600 dark:text-neutral-400"
          aria-label="Methods"
        >
          <ul className="contents">
            {MENU[chain]?.map(({ name, href }) => (
              <li className="contents" key={href}>
                <MenuButton href={href}>{name}</MenuButton>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="w-64" />
    </>
  );
};

const baseMenuButtonClasses = "text-sm py-1 px-2";

const MenuButton = ({ className, ...props }: ComponentProps<typeof Link>) => {
  const segments = useSelectedLayoutSegments();

  return `/price-feeds/${segments.join("/")}` === props.href ? (
    <div
      className={clsx(
        "font-bold text-pythpurple-600 dark:text-pythpurple-400",
        baseMenuButtonClasses,
        className,
      )}
    >
      {props.children}
    </div>
  ) : (
    <Link
      className={clsx(
        "rounded hover:bg-neutral-200 hover:text-pythpurple-600 dark:hover:bg-neutral-800 dark:hover:text-pythpurple-400",
        baseMenuButtonClasses,
        className,
      )}
      {...props}
    />
  );
};
