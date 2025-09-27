import { Code } from "@phosphor-icons/react/dist/ssr/Code";
import { DiscordLogo } from "@phosphor-icons/react/dist/ssr/DiscordLogo";
import { GithubLogo } from "@phosphor-icons/react/dist/ssr/GithubLogo";
import { TelegramLogo } from "@phosphor-icons/react/dist/ssr/TelegramLogo";
import { UsersThree } from "@phosphor-icons/react/dist/ssr/UsersThree";
import { XLogo } from "@phosphor-icons/react/dist/ssr/XLogo";
import { YoutubeLogo } from "@phosphor-icons/react/dist/ssr/YoutubeLogo";

export const socialLinks = [
  {
    name: "GitHub",
    icon: <GithubLogo />,
    href: "https://github.com/pyth-network",
  },
  {
    name: "Pyth Dev Forum",
    icon: <Code />,
    href: "https://dev-forum.pyth.network/",
  },
  {
    name: "X",
    icon: <XLogo />,
    href: "https://x.com/PythNetwork",
  },
  {
    name: "Discord",
    icon: <DiscordLogo />,
    href: "https://discord.gg/invite/PythNetwork",
  },
  {
    name: "Telegram",
    icon: <TelegramLogo />,
    href: "https://t.me/Pyth_Network",
  },
  {
    name: "Youtube",
    icon: <YoutubeLogo />,
    href: "https://www.youtube.com/channel/UCjCkvPN9ohl0UDvldfn1neg",
  },
  {
    name: "Pyth DAO Forum",
    icon: <UsersThree />,
    href: "https://forum.pyth.network/",
  },
];
