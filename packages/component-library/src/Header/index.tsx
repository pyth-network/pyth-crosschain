import { BookOpenText } from "@phosphor-icons/react/dist/ssr/BookOpenText";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { Code } from "@phosphor-icons/react/dist/ssr/Code";
import { Coins } from "@phosphor-icons/react/dist/ssr/Coins";
import { Gavel } from "@phosphor-icons/react/dist/ssr/Gavel";
import { Lifebuoy } from "@phosphor-icons/react/dist/ssr/Lifebuoy";
import { List } from "@phosphor-icons/react/dist/ssr/List";
import { Plug } from "@phosphor-icons/react/dist/ssr/Plug";
import { ShieldChevron } from "@phosphor-icons/react/dist/ssr/ShieldChevron";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

import { socialLinks } from "../social-links.jsx";
import styles from "./index.module.scss";
import Logo from "./logo.svg";
import { ThemeSwitch } from "./theme-switch.jsx";
import { Button } from "../Button/index.jsx";
import type { Props as CardProps } from "../Card/index.jsx";
import { Card } from "../Card/index.jsx";
import { Link } from "../Link/index.jsx";
import type { Link as UnstyledLink } from "../unstyled/Link/index.jsx";

type Props = ComponentProps<"header"> & {
  appName: string;
  mainCta?:
    | {
        label: string;
        href: string;
      }
    | undefined;
  mainMenu?: ReactNode | undefined;
  extraCta?: ReactNode | undefined;
};

export const Header = ({
  className,
  appName,
  mainCta,
  mainMenu,
  extraCta,
  ...props
}: Props) => (
  <header className={clsx(styles.header, className)} {...props}>
    <div className={styles.content}>
      <div className={styles.leftMenu}>
        <Link href="/" className={styles.logoLink ?? ""}>
          <div className={styles.logoWrapper}>
            <Logo className={styles.logo} />
          </div>
          <div className={styles.logoLabel}>Pyth Homepage</div>
        </Link>
        <div className={styles.appName}>{appName}</div>
        {mainMenu}
      </div>
      <div className={styles.rightMenu}>
        <Button
          variant="ghost"
          size="sm"
          rounded
          beforeIcon={<Lifebuoy />}
          drawer={SupportDrawer}
          className={styles.supportButton ?? ""}
        >
          Support
        </Button>
        {extraCta}
        <MobileMenu className={styles.mobileMenu} />
        <Button
          href={mainCta?.href ?? "https://docs.pyth.network"}
          size="sm"
          rounded
          target="_blank"
          className={styles.mainCta ?? ""}
        >
          {mainCta?.label ?? "Dev Docs"}
        </Button>
        <ThemeSwitch className={styles.themeSwitch ?? ""} />
      </div>
    </div>
  </header>
);

const MobileMenu = ({ className }: { className?: string | undefined }) => (
  <Button
    className={className ?? ""}
    beforeIcon={<List />}
    variant="ghost"
    size="sm"
    rounded
    hideText
    drawer={{
      hideHeading: true,
      title: "Menu",
      contents: <MobileMenuContents />,
    }}
  >
    Menu
  </Button>
);

const MobileMenuContents = () => (
  <div className={styles.mobileMenuContents}>
    <div className={styles.buttons}>
      <Button
        variant="ghost"
        size="md"
        rounded
        beforeIcon={<Lifebuoy />}
        drawer={SupportDrawer}
      >
        Support
      </Button>
      <Button
        href="https://docs.pyth.network"
        size="md"
        rounded
        target="_blank"
      >
        Dev Docs
      </Button>
    </div>
    <div className={styles.theme}>
      <span className={styles.themeLabel}>Theme</span>
      <ThemeSwitch />
    </div>
  </div>
);

type LinkListProps = {
  title: ReactNode;
  links: (Omit<
    CardProps<typeof UnstyledLink>,
    "title" | "icon" | "description"
  > & {
    title: ReactNode;
    icon: ReactNode;
    description?: ReactNode | undefined;
  })[];
};

const LinkList = ({ title, links }: LinkListProps) => (
  <div className={styles.linkList}>
    <h3 className={styles.title}>{title}</h3>
    <ul className={styles.items}>
      {links.map(({ title, icon, description, ...link }, i) => (
        <Card key={i} {...link}>
          <div className={styles.link}>
            <div className={styles.icon}>{icon}</div>
            <h4 className={styles.linkTitle}>{title}</h4>
            {description && <p className={styles.description}>{description}</p>}
            <CaretRight className={styles.caret} />
          </div>
        </Card>
      ))}
    </ul>
  </div>
);

export const SupportDrawer = {
  title: "Support",
  bodyClassName: styles.supportDrawer,
  contents: (
    <>
      <LinkList
        title="Integration"
        links={[
          {
            icon: <Plug />,
            title: "Connect directly with real-time market data",
            description: "Integrate the Pyth data feeds into your app",
            target: "_blank",
            href: "https://docs.pyth.network/price-feeds/use-real-time-data",
          },
          {
            icon: <BookOpenText />,
            title: "Learn how to work with Pyth data",
            description: "Read the Pyth Network documentation",
            target: "_blank",
            href: "https://docs.pyth.network",
          },
          {
            icon: <Code />,
            title: "Try out the APIs",
            description:
              "Use the Pyth Network API Reference to experience the Pyth APIs",
            target: "_blank",
            href: "https://api-reference.pyth.network",
          },
        ]}
      />
      <LinkList
        title="$PYTH Token"
        links={[
          {
            icon: <Coins />,
            title: "Tokenomics",
            description:
              "Learn about how the $PYTH token is structured and distributed",
            target: "_blank",
            href: "https://docs.pyth.network/home/pyth-token/pyth-distribution",
          },
          {
            icon: <ShieldChevron />,
            title: "Oracle Integrity Staking (OIS) Guide",
            description: "Learn how to help secure the oracle and earn rewards",
            target: "_blank",
            href: "https://docs.pyth.network/home/oracle-integrity-staking",
          },
          {
            icon: <Gavel />,
            title: "Pyth Governance Guide",
            description:
              "Gain voting power to help shape the future of DeFi by participating in governance",
            target: "_blank",
            href: "https://docs.pyth.network/home/pyth-token#staking-pyth-for-governance",
          },
        ]}
      />
      <LinkList
        title="Community"
        links={socialLinks.map(({ icon, href, name }) => ({
          href,
          target: "_blank",
          title: name,
          description: href,
          icon,
        }))}
      />
    </>
  ),
};
