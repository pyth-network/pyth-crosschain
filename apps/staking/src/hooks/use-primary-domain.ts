import { getPrimaryDomain } from "@bonfida/spl-name-service";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";

export const usePrimaryDomain = () => {
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

  return primaryDomain;
};
