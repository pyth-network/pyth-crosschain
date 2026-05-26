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
  | "stacks"
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
  stacks: "Stacks",
  starknet: "Starknet",
  ton: "TON",
};

const SUPPORTED_SIMPLE = new Set<Chain>(["sui", "solana"]);
const SUPPORTED_PARTIAL = new Set<Chain>(["evm"]);

type Props = { chain: Chain };

const TITLE = "Pyth Core upgrades on July 31, 2026";

export const UpgradeCallout = ({ chain }: Props) => {
  const upgradeGuide = "/price-feeds/core/upgrade/preparing";
  const upgradedAddressesRoot = "/price-feeds/core/upgrade/contracts";
  const contactMail = "mailto:data@dourolabs.xyz";

  if (chain === "index") {
    return (
      <Callout type="warn" title={TITLE}>
        <ul className="list-disc pl-5 my-0! space-y-1">
          <li>
            See the <Link href={upgradeGuide}>upgrade guide</Link> and the{" "}
            <Link href={upgradedAddressesRoot}>
              upgraded contract addresses
            </Link>{" "}
            for chains in the upgrade.
          </li>
          <li>
            <a href={contactMail}>Contact the team</a> if your chain
            isn&apos;t listed.
          </li>
        </ul>
      </Callout>
    );
  }

  const label = CHAIN_LABELS[chain];
  const upgradedAddresses = `${upgradedAddressesRoot}#${chain}`;

  if (SUPPORTED_SIMPLE.has(chain)) {
    return (
      <Callout type="warn" title={TITLE}>
        <ul className="list-disc pl-5 my-0! space-y-1">
          <li>The addresses below are auto-upgraded by the DAO at cutover.</li>
          <li>
            See the <Link href={upgradeGuide}>upgrade guide</Link> and the{" "}
            <Link href={upgradedAddresses}>upgraded {label} addresses</Link>.
          </li>
        </ul>
      </Callout>
    );
  }

  if (SUPPORTED_PARTIAL.has(chain)) {
    return (
      <Callout type="warn" title={TITLE}>
        <ul className="list-disc pl-5 my-0! space-y-1">
          <li>
            Check the{" "}
            <Link href={upgradedAddresses}>upgraded {label} addresses</Link>{" "}
            for chains in the upgrade.
          </li>
          <li>
            See the <Link href={upgradeGuide}>upgrade guide</Link> for how to
            upgrade.
          </li>
          <li>
            <a href={contactMail}>Contact the team</a> if your chain
            isn&apos;t listed.
          </li>
        </ul>
      </Callout>
    );
  }

  return (
    <Callout
      type="warn"
      title={`Pyth Core will no longer support ${label} after July 31, 2026`}
    >
      <ul className="list-disc pl-5 my-0! space-y-1">
        <li>
          See the <Link href={upgradeGuide}>upgrade guide</Link> to learn about
          the upgrade.
        </li>
        <li>
          <a href={contactMail}>Contact the team</a> to request a Pyth Core
          contract deployment on {label}.
        </li>
      </ul>
    </Callout>
  );
};
