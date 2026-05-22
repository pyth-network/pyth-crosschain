"use client";

import { useState } from "react";
import { ModalDialog } from "../ModalDialog";

export const Changelog = () => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <ModalDialog
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      title="Retiring OIS Rewards"
    >
      <p className="max-w-prose text-sm">
        Due to the network upgrade from Pyth Core to Pyth Pro, Oracle Integrity
        Staking rewards have been set to 0. You can unstake and withdraw your
        tokens at any time. Governance staking is not impacted by this change.
        Read more{" "}
        <a
          className="cursor-pointer text-pythpurple-400 underline hover:no-underline"
          href="https://forum.pyth.network/t/coming-soon-op-pip-103-pausing-ois-rewards/2471"
          target="_blank"
        >
          here
        </a>
        .
      </p>
    </ModalDialog>
  );
};
