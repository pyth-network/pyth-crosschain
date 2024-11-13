import { useLogger } from "@pythnetwork/app-logger";
import { Button } from "@pythnetwork/component-library/Button";
import { useEffect } from "react";

import { MaxWidth } from "../MaxWidth";

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
    <MaxWidth>
      <h1>Uh oh!</h1>
      <h2>Something went wrong</h2>
      <p>
        Error Details: <strong>{error.digest ?? error.message}</strong>
      </p>
      {reset && <Button onPress={reset}>Reset</Button>}
    </MaxWidth>
  );
};
