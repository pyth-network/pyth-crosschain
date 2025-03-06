import { Info } from "@phosphor-icons/react/dist/ssr/Info";
import { Lightbulb } from "@phosphor-icons/react/dist/ssr/Lightbulb";
import { Alert, AlertTrigger } from "@pythnetwork/component-library/Alert";
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
    <AlertTrigger>
      <Button
        className={styles.trigger ?? ""}
        variant="ghost"
        size={size}
        beforeIcon={(props) => <Info weight="fill" {...props} />}
        rounded
        hideText
      >
        Explain {title}
      </Button>
      <Alert
        title={title}
        icon={<Lightbulb />}
        bodyClassName={styles.description}
      >
        {children}
      </Alert>
    </AlertTrigger>
  </div>
);
