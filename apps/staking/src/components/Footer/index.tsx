import clsx from "clsx";
import type { HTMLAttributes } from "react";

import Discord from "./discord.svg";
import Github from "./github.svg";
import LinkedIn from "./linkedin.svg";
import Telegram from "./telegram.svg";
import X from "./x.svg";
import Youtube from "./youtube.svg";
import Logo from "../Header/logo.svg";
import { Link } from "../Link";
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
      "mt-4 text-xs font-light sm:sticky sm:bottom-0 sm:px-4",
      className,
    )}
    {...props}
  >
    <div className="border-t border-neutral-600/50 bg-pythpurple-800 sm:border-x">
      <MaxWidth className="flex flex-col items-center gap-10 py-8 sm:-mx-4 sm:h-16 sm:flex-row sm:justify-between">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4 md:gap-8">
          <Link href="https://www.pyth.network" target="_blank">
            <Logo className="h-10 sm:h-8" />
          </Link>
          <div>© 2024 Pyth Data Association</div>
        </div>
        <div className="relative flex h-full items-center sm:-right-3">
          {SOCIAL_LINKS.map(({ name, icon: Icon, href }) => (
            <Link
              target="_blank"
              href={href}
              key={name}
              className="grid h-full place-content-center px-3 hover:text-pythpurple-400"
              rel="noreferrer"
            >
              <Icon className="size-4" />
              <span className="sr-only">{name}</span>
            </Link>
          ))}
        </div>
      </MaxWidth>
    </div>
  </footer>
);
