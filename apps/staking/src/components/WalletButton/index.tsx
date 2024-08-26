"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import type { ComponentProps } from "react";

import { usePrimaryDomain } from "../../hooks/use-primary-domain";

export const WalletButton = (
  props: ComponentProps<typeof WalletMultiButton>,
) => {
  const primaryDomain = usePrimaryDomain();

  return <WalletMultiButton {...props}>{primaryDomain}</WalletMultiButton>;
};
