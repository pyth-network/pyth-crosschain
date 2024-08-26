"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback } from "react";

import { useIsMounted } from "../../hooks/use-is-mounted";
import { Button } from "../Button";
import { Dashboard } from "../Dashboard";
import { LoadingSpinner } from "../LoadingSpinner";

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
      <Dashboard />
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
    return <LoadingSpinner />;
  }
};
