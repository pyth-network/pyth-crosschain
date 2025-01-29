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
  <>
    <footer
      className={clsx(
        "sticky bottom-0 w-full bg-white dark:bg-pythpurple-900",
        className,
      )}
      {...props}
    >
      <MaxWidth className="flex h-16 items-center justify-between text-xs font-light text-neutral-600 dark:text-neutral-400">
        <div className="flex h-full items-center gap-4">
          <span>© 2025 Pyth Data Association</span>
        </div>
        <div className="flex h-full items-center gap-6">
          {SOCIAL_LINKS.map(({ name, icon: Icon, href }) => (
            <a
              target="_blank"
              href={href}
              key={name}
              className="hover:text-pythpurple-600 dark:hover:text-pythpurple-400"
              rel="noreferrer"
            >
              <Icon className="h-4" />
              <span className="sr-only">{name}</span>
            </a>
          ))}
        </div>
      </MaxWidth>
    </footer>
  </>
);
