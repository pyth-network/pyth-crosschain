import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { WalletError } from "@solana/wallet-adapter-base";
import clsx from "clsx";
import { LazyMotion, m, domAnimation } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { Button } from "react-aria-components";

export const ErrorMessage = ({ error }: { error: unknown }) => {
  return error instanceof WalletError ? (
    <p className="text-red-600">
      The transaction was rejected by your wallet. Please check your wallet and
      try again.
    </p>
  ) : (
    <UnknownError error={error} />
  );
};

const UnknownError = ({ error }: { error: unknown }) => {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const toggleDetailsOpen = useCallback(() => {
    setDetailsOpen((cur) => !cur);
  }, [setDetailsOpen]);

  const message = useMemo(() => {
    if (error instanceof Error) {
      return error.toString();
    } else if (typeof error === "string") {
      return error;
    } else {
      return "An unknown error occurred";
    }
  }, [error]);

  return (
    <LazyMotion features={domAnimation}>
      <Button onPress={toggleDetailsOpen} className="text-left">
        <div className="text-red-600">
          Uh oh, an error occurred! Please try again
        </div>
        <div className="flex flex-row items-center gap-[0.25em] text-xs opacity-60">
          <div>Details</div>
          <ChevronRightIcon
            className={clsx("inline-block size-[1em] transition-transform", {
              "rotate-90": detailsOpen,
            })}
          />
        </div>
      </Button>
      <m.div
        className="overflow-hidden pt-1 opacity-60"
        initial={{ height: 0 }}
        animate={{ height: detailsOpen ? "auto" : 0 }}
      >
        {message}
      </m.div>
    </LazyMotion>
  );
};
