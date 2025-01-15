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
      "text-xs font-light lg:sticky lg:bottom-0 lg:px-4",
      className,
    )}
    {...props}
  >
    <div className="border-t border-neutral-600/50 bg-pythpurple-800 lg:border-x">
      <MaxWidth className="flex h-48 flex-col items-center justify-between overflow-hidden pb-4 pt-8 text-center lg:-mx-4 lg:h-16 lg:flex-row lg:gap-10 lg:py-0">
        <div className="flex flex-col items-center gap-2 lg:flex-row lg:gap-8">
          <Link
            href="https://www.pyth.network"
            target="_blank"
            className="focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400"
          >
            <Logo className="h-10 lg:h-8" />
            <span className="sr-only">Pyth homepage</span>
          </Link>
          <div>© 2025 Pyth Data Association</div>
        </div>
        <div className="flex flex-col items-center gap-6 lg:flex-row-reverse lg:gap-8 xl:gap-16">
          <div className="relative flex h-full items-center lg:-right-3">
            {SOCIAL_LINKS.map(({ name, icon: Icon, href }) => (
              <Link
                target="_blank"
                href={href}
                key={name}
                className="grid h-full place-content-center px-3 transition hover:text-pythpurple-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400"
                rel="noreferrer"
              >
                <Icon className="size-4" />
                <span className="sr-only">{name}</span>
              </Link>
            ))}
          </div>
          <div className="flex flex-row gap-1 xl:gap-4">
            <Link
              className="-my-1 px-2 py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400"
              target="_blank"
              href="https://pythdataassociation.com/privacy-policy"
            >
              Privacy Policy
            </Link>
            <Link
              className="-my-1 px-2 py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400"
              target="_blank"
              href="https://pythdataassociation.com/terms-of-use"
            >
              Terms of Use
            </Link>
            <Link
              className="-my-1 px-2 py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400"
              href="/terms-of-service"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </MaxWidth>
    </div>
  </footer>
);
