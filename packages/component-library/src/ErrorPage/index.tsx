import { Warning } from "@phosphor-icons/react/dist/ssr/Warning";
import { useEffect } from "react";

import { Button } from "../Button";
import { useLogger } from "../useLogger";
import styles from "./index.module.scss";

type Props = {
  error: Error & { digest?: string };
  reset?: () => void;
};

export const ErrorPage = ({ error, reset }: Props) => {
  const logger = useLogger();

  useEffect(() => {
    logger.error(error);
  }, [error, logger]);

  return (
    <div className={styles.errorPage}>
      <Warning className={styles.errorIcon} />
      <div className={styles.text}>
        <h2 className={styles.header}>Uh oh!</h2>
        <p className={styles.subheader}>Something went wrong</p>
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
