"use client";

import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback } from "react";

import { WalletButton } from "./wallet-button";
import { useIsMounted } from "../../use-is-mounted";
import { Button } from "../Button";
import { Dashboard } from "../Dashboard";

export const Home = () => (
  <main className="px-8 py-16">
    <h1 className="mb-8 text-4xl font-semibold text-pythpurple-600 dark:text-pythpurple-400">
      Staking & Delegating
    </h1>
    <HomeContents />
  </main>
);

const HomeContents = () => {
  const isMounted = useIsMounted();
  const wallet = useWallet();
  const modal = useWalletModal();
  const showModal = useCallback(() => {
    modal.setVisible(true);
  }, [modal]);
  if (isMounted) {
    return wallet.connected ? (
      <>
        <WalletButton />
        <Dashboard />
      </>
    ) : (
      <>
        <p className="mx-auto mb-8 max-w-prose text-center">
          The Pyth staking program allows you to stake tokens to participate in
          governance, or to earn yield and protect DeFi by delegating to
          publishers.
        </p>
        <div className="grid w-full place-content-center">
          <Button onClick={showModal}>
            Connect your wallet to participate
          </Button>
        </div>
      </>
    );
  } else {
    return <ArrowPathIcon className="size-6 animate-spin" />;
  }
};
