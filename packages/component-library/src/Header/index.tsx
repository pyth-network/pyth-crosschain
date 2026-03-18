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
import { Button } from "../Button/index.jsx";
import type { Props as CardProps } from "../Card/index.jsx";
import { Card } from "../Card/index.jsx";
import { Link } from "../Link/index.jsx";
import { socialLinks } from "../social-links.jsx";
import type { Link as UnstyledLink } from "../unstyled/Link/index.jsx";
import styles from "./index.module.scss";
import Logo from "./logo.svg";
import { ThemeSwitch } from "./theme-switch.jsx";

export { default as Logo } from "./logo.svg";

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
  displaySupportButton?: boolean | undefined;
};

export const Header = ({
  className,
  appName,
  mainCta,
  mainMenu,
  extraCta,
  displaySupportButton = true,
  ...props
}: Props) => (
  <header className={clsx(styles.header, className)} {...props}>
    <div className={styles.content}>
      <div className={styles.leftMenu}>
        <Link className={styles.logoLink ?? ""} href="/">
          <div className={styles.logoWrapper}>
            <Logo className={styles.logo} />
          </div>
          <div className={styles.logoLabel}>Pyth Homepage</div>
        </Link>
        <div className={styles.appName}>{appName}</div>
        {mainMenu}
      </div>
      <div className={styles.rightMenu}>
        {displaySupportButton && (
          <Button
            beforeIcon={<Lifebuoy />}
            className={styles.supportButton ?? ""}
            drawer={SupportDrawer}
            rounded
            size="sm"
            variant="ghost"
          >
            Support
          </Button>
        )}
        {extraCta}
        <MobileMenu className={styles.mobileMenu} mainCta={mainCta} />
        <Button
          className={styles.mainCta ?? ""}
          href={mainCta?.href ?? "https://docs.pyth.network"}
          rounded
          size="sm"
          target="_blank"
        >
          {mainCta?.label ?? "Dev Docs"}
        </Button>
        <ThemeSwitch className={styles.themeSwitch ?? ""} />
      </div>
    </div>
  </header>
);

const MobileMenu = ({
  className,
  mainCta,
}: {
  className?: string | undefined;
  mainCta: Props["mainCta"];
}) => (
  <Button
    beforeIcon={<List />}
    className={className ?? ""}
    drawer={{
      contents: <MobileMenuContents mainCta={mainCta} />,
      hideHeading: true,
      title: "Menu",
    }}
    hideText
    rounded
    size="sm"
    variant="ghost"
  >
    Menu
  </Button>
);

const MobileMenuContents = ({ mainCta }: { mainCta: Props["mainCta"] }) => (
  <div className={styles.mobileMenuContents}>
    <div className={styles.buttons}>
      <Button
        beforeIcon={<Lifebuoy />}
        drawer={SupportDrawer}
        rounded
        size="md"
        variant="ghost"
      >
        Support
      </Button>
      <Button
        href={mainCta?.href ?? "https://docs.pyth.network"}
        rounded
        size="md"
        target="_blank"
      >
        {mainCta?.label ?? "Dev Docs"}
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
  bodyClassName: styles.supportDrawer,
  contents: (
    <>
      <LinkList
        links={[
          {
            description: "Integrate the Pyth data feeds into your app",
            href: "https://docs.pyth.network/price-feeds/use-real-time-data",
            icon: <Plug />,
            target: "_blank",
            title: "Connect directly with real-time market data",
          },
          {
            description: "Read the Pyth Network documentation",
            href: "https://docs.pyth.network",
            icon: <BookOpenText />,
            target: "_blank",
            title: "Learn how to work with Pyth data",
          },
          {
            description:
              "Use the Pyth Network API Reference to experience the Pyth APIs",
            href: "https://api-reference.pyth.network",
            icon: <Code />,
            target: "_blank",
            title: "Try out the APIs",
          },
        ]}
        title="Integration"
      />
      <LinkList
        links={[
          {
            description:
              "Learn about how the $PYTH token is structured and distributed",
            href: "https://docs.pyth.network/home/pyth-token/pyth-distribution",
            icon: <Coins />,
            target: "_blank",
            title: "Tokenomics",
          },
          {
            description: "Learn how to help secure the oracle and earn rewards",
            href: "https://docs.pyth.network/home/oracle-integrity-staking",
            icon: <ShieldChevron />,
            target: "_blank",
            title: "Oracle Integrity Staking (OIS) Guide",
          },
          {
            description:
              "Gain voting power to help shape the future of DeFi by participating in governance",
            href: "https://docs.pyth.network/home/pyth-token#staking-pyth-for-governance",
            icon: <Gavel />,
            target: "_blank",
            title: "Pyth Governance Guide",
          },
        ]}
        title="$PYTH Token"
      />
      <LinkList
        links={socialLinks.map(({ icon, href, name }) => ({
          description: href,
          href,
          icon,
          target: "_blank",
          title: name,
        }))}
        title="Community"
      />
    </>
  ),
  title: "Support",
};

export { default as HeaderLogo } from "./logo.svg";
