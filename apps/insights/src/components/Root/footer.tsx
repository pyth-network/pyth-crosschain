import { DiscordLogo } from "@phosphor-icons/react/dist/ssr/DiscordLogo";
import { GithubLogo } from "@phosphor-icons/react/dist/ssr/GithubLogo";
import { TelegramLogo } from "@phosphor-icons/react/dist/ssr/TelegramLogo";
import { XLogo } from "@phosphor-icons/react/dist/ssr/XLogo";
import { YoutubeLogo } from "@phosphor-icons/react/dist/ssr/YoutubeLogo";
import { ButtonLink } from "@pythnetwork/component-library/Button";
import { Link } from "@pythnetwork/component-library/Link";
import type { ComponentProps } from "react";

import styles from "./footer.module.scss";
import Wordmark from "./wordmark.svg";

export const Footer = () => (
  <footer className={styles.footer}>
    <div className={styles.topContent}>
      <div className={styles.left}>
        <Link href="https://www.pyth.network" className={styles.logoLink ?? ""}>
          <Wordmark className={styles.logo} />
          <div className={styles.logoLabel}>Pyth Homepage</div>
        </Link>
        <div className={styles.divider} />
        <div className={styles.help}>
          <Link href="/">Help</Link>
          <Link href="https://docs.pyth.network" target="_blank">
            Documentation
          </Link>
        </div>
      </div>
      <div className={styles.right}>
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
    </div>
    <div className={styles.bottomContent}>
      <small className={styles.copyright}>© 2024 Pyth Data Association</small>
      <div className={styles.legal}>
        <Link href="https://www.pyth.network/privacy-policy" target="_blank">
          Privacy Policy
        </Link>
        <Link href="https://www.pyth.network/terms-of-use" target="_blank">
          Terms of Use
        </Link>
      </div>
    </div>
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
