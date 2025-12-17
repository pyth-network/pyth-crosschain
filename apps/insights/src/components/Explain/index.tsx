import { Info } from "@phosphor-icons/react/dist/ssr/Info";
import { Lightbulb } from "@phosphor-icons/react/dist/ssr/Lightbulb";
import { Button } from "@pythnetwork/component-library/Button";
import type { ComponentProps, ReactNode } from "react";

import styles from "./index.module.scss";

type Props = {
  size: ComponentProps<typeof Button>["size"];
  title: string;
  children: ReactNode;
};

export const Explain = ({ size, title, children }: Props) => (
  <div className={styles.explain}>
    <Button
      className={styles.trigger ?? ""}
      variant="ghost"
      size={size}
      beforeIcon={<Info weight="fill" />}
      rounded
      hideText
      alert={{
        title,
        icon: <Lightbulb />,
        bodyClassName: styles.description,
        contents: children,
      }}
    >
      Explain {title}
    </Button>
  </div>
);
