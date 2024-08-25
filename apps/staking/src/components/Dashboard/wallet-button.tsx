"use client";

import { getPrimaryDomain } from "@bonfida/spl-name-service";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { type ComponentProps, useEffect, useState } from "react";

export const WalletButton = (
  props: ComponentProps<typeof WalletMultiButton>,
) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [primaryDomain, setPrimaryDomain] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    if (wallet.publicKey) {
      getPrimaryDomain(connection, wallet.publicKey)
        .then((domain) => {
          setPrimaryDomain(`${domain.reverse}.sol`);
        })
        .catch(() => {
          /* no-op, no worries if we can't show a SNS domain */
        });
    }
  }, [wallet.publicKey, connection]);

  return <WalletMultiButton {...props}>{primaryDomain}</WalletMultiButton>;
};
