import { Warning } from "@phosphor-icons/react/dist/ssr/Warning";
import { useLogger } from "@pythnetwork/app-logger";
import { Button } from "@pythnetwork/component-library/Button";
import { useEffect } from "react";

import styles from "./index.module.scss";

type Props = {
  error: Error & { digest?: string };
  reset?: () => void;
};

export const Error = ({ error, reset }: Props) => {
  const logger = useLogger();

  useEffect(() => {
    logger.error(error);
  }, [error, logger]);

  return (
    <div className={styles.error}>
      <Warning className={styles.errorIcon} />
      <div className={styles.text}>
        <h1 className={styles.header}>Uh oh!</h1>
        <h2 className={styles.subheader}>Something went wrong</h2>
        <code className={styles.details}>{error.digest ?? error.message}</code>
      </div>
      {reset && (
        <Button onPress={reset} size="lg">
          Reset
        </Button>
      )}
    </div>
  );
};
