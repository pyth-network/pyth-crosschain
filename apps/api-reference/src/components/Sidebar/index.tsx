"use client";

import { Field, Label } from "@headlessui/react";
import clsx from "clsx";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import {
  type HTMLAttributes,
  useState,
  type ComponentProps,
  type ElementType,
  Fragment,
} from "react";
import Markdown from "react-markdown";

import * as apis from "../../apis";
import { MARKDOWN_COMPONENTS } from "../../markdown-components";
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
    Object.entries(methods).map(([name, { summary }]) => ({
      name,
      summary,
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
            {MENU[chain]?.map(({ name, href, summary }) => (
              <li className="contents" key={href}>
                <MenuButton href={href} name={name}>
                  {summary}
                </MenuButton>
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
> & {
  name: string;
  children: string;
};

const MenuButton = ({
  className,
  name,
  children,
  ...props
}: MenuButtonProps) => {
  const segments = useSelectedLayoutSegments();

  return `/price-feeds/${segments.join("/")}` === props.href ? (
    <MenuItem
      className={className}
      name={name}
      summary={children}
      nameClassName="font-bold text-pythpurple-600 dark:text-pythpurple-400"
    />
  ) : (
    <MenuItem
      as={Link}
      className={clsx(
        "group hover:bg-neutral-200 dark:hover:bg-neutral-800",
        className,
      )}
      nameClassName="group-hover:text-pythpurple-600 dark:group-hover:text-pythpurple-400"
      name={name}
      summary={children}
      {...props}
    />
  );
};

type MenuItemProps<T extends ElementType> = {
  as?: T;
  name: string;
  summary: string;
  nameClassName?: string | undefined;
};

const MenuItem = <T extends ElementType>({
  as,
  className,
  name,
  summary,
  nameClassName,
  ...props
}: Omit<ComponentProps<T>, keyof MenuItemProps<T>> & MenuItemProps<T>) => {
  const Component = as ?? "div";
  return (
    <Component className={clsx("rounded px-2 py-1", className)} {...props}>
      <div className={clsx("text-sm", nameClassName)}>{name}</div>
      <Markdown
        className={clsx(
          "ml-4 overflow-hidden text-ellipsis text-nowrap text-xs font-light",
          className,
        )}
        components={{
          ...MARKDOWN_COMPONENTS,
          p: ({ children }) => <Fragment>{children}</Fragment>,
        }}
      >
        {summary}
      </Markdown>
    </Component>
  );
};
