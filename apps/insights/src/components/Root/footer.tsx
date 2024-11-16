import {
  TelegramLogo,
  GithubLogo,
  XLogo,
  DiscordLogo,
  YoutubeLogo,
} from "@phosphor-icons/react/dist/ssr";
import { ButtonLink } from "@pythnetwork/component-library/Button";
import { Link } from "@pythnetwork/component-library/Link";
import type { ComponentProps } from "react";

import Wordmark from "./wordmark.svg";
import { MaxWidth } from "../MaxWidth";

export const Footer = () => (
  <footer className="z-10 space-y-6 bg-beige-100 py-6 sm:border-t sm:border-stone-300 sm:bg-white xl:space-y-12 xl:py-8 dark:bg-steel-900 dark:sm:border-steel-600 sm:dark:bg-steel-950">
    <MaxWidth className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-stretch justify-between gap-8 sm:gap-6">
        <Link href="https://www.pyth.network" className="-m-2 rounded p-2">
          <Wordmark className="h-5" />
          <div className="sr-only">Pyth Homepage</div>
        </Link>
        <div className="hidden w-px bg-stone-300 sm:block dark:bg-steel-600" />
        <div className="space-x-6 text-sm">
          <Link href="/">Help</Link>
          <Link href="https://docs.pyth.network" target="_blank">
            Documentation
          </Link>
        </div>
      </div>
      <div className="-mx-button-padding-sm flex items-center justify-between sm:justify-end sm:gap-2">
        <SocialLink href="https://t.me/Pyth_Network" icon={TelegramLogo}>
          Telegram
        </SocialLink>
        <SocialLink href="https://github.com/pyth-network" icon={GithubLogo}>
          Github
        </SocialLink>
        <SocialLink href="https://x.com/PythNetwork" icon={XLogo}>
          X
        </SocialLink>
        <SocialLink
          href="https://discord.gg/invite/PythNetwork"
          icon={DiscordLogo}
        >
          Discord
        </SocialLink>
        <SocialLink
          href="https://www.youtube.com/@pythnetwork"
          icon={YoutubeLogo}
        >
          YouTube
        </SocialLink>
      </div>
    </MaxWidth>
    <MaxWidth className="flex flex-col gap-6 sm:flex-row sm:justify-between">
      <small className="text-xs text-stone-600 dark:text-steel-400">
        © 2024 Pyth Data Association
      </small>
      <div className="space-x-6 text-xs">
        <Link href="https://www.pyth.network/privacy-policy" target="_blank">
          Privacy Policy
        </Link>
        <Link href="https://www.pyth.network/terms-of-use" target="_blank">
          Terms of Use
        </Link>
      </div>
    </MaxWidth>
  </footer>
);

type SocialLinkProps = Omit<
  ComponentProps<typeof ButtonLink>,
  "target" | "variant" | "size" | "beforeIcon" | "hideText"
> & {
  icon: ComponentProps<typeof ButtonLink>["beforeIcon"];
};

const SocialLink = ({ icon, ...props }: SocialLinkProps) => (
  <ButtonLink
    target="_blank"
    variant="ghost"
    size="sm"
    beforeIcon={icon}
    hideText
    {...props}
  />
);
