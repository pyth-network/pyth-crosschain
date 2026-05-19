import { DiscordLogo } from "@phosphor-icons/react/dist/ssr/DiscordLogo";
import { GithubLogo } from "@phosphor-icons/react/dist/ssr/GithubLogo";
import { TelegramLogo } from "@phosphor-icons/react/dist/ssr/TelegramLogo";
import { XLogo } from "@phosphor-icons/react/dist/ssr/XLogo";
import { YoutubeLogo } from "@phosphor-icons/react/dist/ssr/YoutubeLogo";

export const socialLinks = [
  {
    href: "https://discord.gg/invite/PythNetwork",
    icon: <DiscordLogo />,
    name: "Discord",
  },
  {
    href: "https://x.com/PythNetwork",
    icon: <XLogo />,
    name: "X",
  },
  {
    href: "https://t.me/Pyth_Network",
    icon: <TelegramLogo />,
    name: "Telegram",
  },
  {
    href: "https://github.com/pyth-network",
    icon: <GithubLogo />,
    name: "GitHub",
  },
  {
    href: "https://www.youtube.com/channel/UCjCkvPN9ohl0UDvldfn1neg",
    icon: <YoutubeLogo />,
    name: "Youtube",
  },
];
