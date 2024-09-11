import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useEffect } from "react";

import { useLogger } from "../../hooks/use-logger";
import { Button } from "../Button";

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
    <main className="flex size-full flex-col items-center justify-center gap-2 py-20 text-center">
      <div className="mb-10 flex flex-row items-center gap-6">
        <ExclamationTriangleIcon className="size-16 text-red-700" />
        <h1 className="text-3xl font-light">Uh oh!</h1>
      </div>
      <h2 className="mb-4 text-xl opacity-80">Something went wrong</h2>
      <div className="text-sm opacity-50">Error Details:</div>
      <strong className="mb-8 border border-pythpurple-400/20 bg-pythpurple-600/50 px-1 py-0.5 text-sm opacity-50">
        {error.digest ?? error.message}
      </strong>
      {reset && <Button onPress={reset}>Reset</Button>}
    </main>
  );
};
