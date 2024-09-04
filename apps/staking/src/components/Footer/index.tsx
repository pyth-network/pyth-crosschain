import clsx from "clsx";
import type { HTMLAttributes } from "react";

import Discord from "./discord.svg";
import Github from "./github.svg";
import LinkedIn from "./linkedin.svg";
import Telegram from "./telegram.svg";
import X from "./x.svg";
import Youtube from "./youtube.svg";
import { MaxWidth } from "../MaxWidth";

const SOCIAL_LINKS = [
  { name: "X", icon: X, href: "https://x.com/PythNetwork" },
  {
    name: "Discord",
    icon: Discord,
    href: "https://discord.gg/invite/PythNetwork",
  },
  { name: "Telegram", icon: Telegram, href: "https://t.me/Pyth_Network" },
  {
    name: "LinkedIn",
    icon: LinkedIn,
    href: "https://www.linkedin.com/company/pyth-network",
  },
  { name: "Github", icon: Github, href: "https://github.com/pyth-network" },
  {
    name: "Youtube",
    icon: Youtube,
    href: "https://www.youtube.com/channel/UCjCkvPN9ohl0UDvldfn1neg",
  },
];

export const Footer = ({
  className,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "children">) => (
  <footer
    className={clsx(
      "sticky bottom-0 mt-4 px-4 text-xs font-light text-neutral-400",
      className,
    )}
    {...props}
  >
    <div className="border-x border-t border-neutral-600/50 bg-pythpurple-800">
      <MaxWidth className="-mx-4 flex h-16 items-center justify-between">
        <div>© 2024 Pyth Data Association</div>
        <div className="relative -right-3 flex h-full items-center">
          {SOCIAL_LINKS.map(({ name, icon: Icon, href }) => (
            <a
              target="_blank"
              href={href}
              key={name}
              className="grid h-full place-content-center px-3 hover:text-pythpurple-400"
              rel="noreferrer"
            >
              <Icon className="size-4" />
              <span className="sr-only">{name}</span>
            </a>
          ))}
        </div>
      </MaxWidth>
    </div>
  </footer>
);
