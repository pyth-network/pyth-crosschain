"use client";

import { Field, Label } from "@headlessui/react";
import clsx from "clsx";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import type { HTMLAttributes, ComponentProps, ElementType } from "react";
import { useState } from "react";

import * as apis from "../../apis";
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
    Object.entries(methods).map(([name]) => ({
      name,
      href: `/price-feeds/${chain}/${name}`,
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
            className="grow"
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

type MenuButtonProps = Omit<
  ComponentProps<typeof Link>,
  keyof MenuItemProps<typeof Link>
>;

const MenuButton = ({ className, children, ...props }: MenuButtonProps) => {
  const segments = useSelectedLayoutSegments();

  return `/price-feeds/${segments.join("/")}` === props.href ? (
    <MenuItem
      className={className}
      nameClassName="font-bold text-pythpurple-600 dark:text-pythpurple-400"
    >
      {children}
    </MenuItem>
  ) : (
    <MenuItem
      as={Link}
      className={clsx(
        "group hover:bg-neutral-200 dark:hover:bg-neutral-800",
        className,
      )}
      nameClassName="group-hover:text-pythpurple-600 dark:group-hover:text-pythpurple-400"
      {...props}
    >
      {children}
    </MenuItem>
  );
};

type MenuItemProps<T extends ElementType> = {
  as?: T;
  nameClassName?: string | undefined;
};

const MenuItem = <T extends ElementType>({
  as,
  className,
  children,
  nameClassName,
  ...props
}: Omit<ComponentProps<T>, keyof MenuItemProps<T>> & MenuItemProps<T>) => {
  const Component = as ?? "div";
  return (
    <Component className={clsx("rounded px-2 py-1", className)} {...props}>
      <div className={clsx("text-sm", nameClassName)}>{children}</div>
    </Component>
  );
};
