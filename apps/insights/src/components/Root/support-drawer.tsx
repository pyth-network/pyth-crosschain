import { BookOpenText } from "@phosphor-icons/react/dist/ssr/BookOpenText";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { Code } from "@phosphor-icons/react/dist/ssr/Code";
import { Coins } from "@phosphor-icons/react/dist/ssr/Coins";
import { Gavel } from "@phosphor-icons/react/dist/ssr/Gavel";
import { Plug } from "@phosphor-icons/react/dist/ssr/Plug";
import { ShieldChevron } from "@phosphor-icons/react/dist/ssr/ShieldChevron";
import {
  type Props as CardProps,
  Card,
} from "@pythnetwork/component-library/Card";
import { DrawerTrigger, Drawer } from "@pythnetwork/component-library/Drawer";
import type { Link as UnstyledLink } from "@pythnetwork/component-library/unstyled/Link";
import type { ReactNode } from "react";

import { socialLinks } from "./social-links";
import styles from "./support-drawer.module.scss";

type Props = {
  children: ReactNode;
};

export const SupportDrawer = ({ children }: Props) => (
  <DrawerTrigger>
    {children}
    <Drawer title="Support" bodyClassName={styles.supportDrawer}>
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
        links={socialLinks.map(({ icon: Icon, href, name }) => ({
          href,
          target: "_blank",
          title: name,
          description: href,
          icon: <Icon />,
        }))}
      />
    </Drawer>
  </DrawerTrigger>
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
            <h4 className={styles.header}>{title}</h4>
            {description && <p className={styles.description}>{description}</p>}
            <CaretRight className={styles.caret} />
          </div>
        </Card>
      ))}
    </ul>
  </div>
);
