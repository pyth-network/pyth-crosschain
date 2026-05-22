import { Callout } from "fumadocs-ui/components/callout";
import Link from "next/link";

type Chain =
  | "index"
  | "evm"
  | "sui"
  | "solana"
  | "aptos"
  | "cosmwasm"
  | "fuel"
  | "iota"
  | "movement"
  | "near"
  | "starknet"
  | "ton";

const CHAIN_LABELS: Record<Exclude<Chain, "index">, string> = {
  evm: "EVM",
  sui: "Sui",
  solana: "Solana",
  aptos: "Aptos",
  cosmwasm: "CosmWasm",
  fuel: "Fuel",
  iota: "IOTA",
  movement: "Movement",
  near: "NEAR",
  starknet: "Starknet",
  ton: "TON",
};

const SUPPORTED_SIMPLE = new Set<Chain>(["sui", "solana"]);
const SUPPORTED_PARTIAL = new Set<Chain>(["evm"]);

type Props = { chain: Chain };

export const UpgradeCallout = ({ chain }: Props) => {
  const upgradeGuide = "/price-feeds/core/upgrade/preparing";
  const upgradedAddressesRoot = "/price-feeds/core/upgrade/contracts";
  const contactMail = "mailto:data@dourolabs.xyz";

  if (chain === "index") {
    return (
      <Callout type="warn">
        <strong>Pyth Core upgrades on July 31, 2026.</strong> See the{" "}
        <Link href={upgradeGuide}>upgrade guide</Link> and the{" "}
        <Link href={upgradedAddressesRoot}>upgraded contract addresses</Link>{" "}
        for chains in the upgrade. <a href={contactMail}>Contact the team</a>{" "}
        if your chain isn&apos;t listed.
      </Callout>
    );
  }

  const label = CHAIN_LABELS[chain];
  const upgradedAddresses = `${upgradedAddressesRoot}#${chain}`;

  if (SUPPORTED_SIMPLE.has(chain)) {
    return (
      <Callout type="warn">
        <strong>Pyth Core upgrades on July 31, 2026.</strong> The addresses
        below are auto-upgraded by the DAO at cutover. See the{" "}
        <Link href={upgradeGuide}>upgrade guide</Link> and the{" "}
        <Link href={upgradedAddresses}>upgraded {label} addresses</Link>.
      </Callout>
    );
  }

  if (SUPPORTED_PARTIAL.has(chain)) {
    return (
      <Callout type="warn">
        <strong>Pyth Core upgrades on July 31, 2026.</strong> Check the{" "}
        <Link href={upgradedAddresses}>upgraded {label} addresses</Link> for
        chains in the upgrade and the{" "}
        <Link href={upgradeGuide}>upgrade guide</Link> for the full path.{" "}
        <a href={contactMail}>Contact the team</a> if your chain isn&apos;t
        listed.
      </Callout>
    );
  }

  return (
    <Callout type="warn">
      <strong>Pyth Core upgrades on July 31, 2026.</strong> {label} is not part
      of the upgrade. See the <Link href={upgradeGuide}>upgrade guide</Link> to
      learn more, or <a href={contactMail}>contact the team</a> for support on
      this chain.
    </Callout>
  );
};
