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
  aptos: "Aptos",
  cosmwasm: "CosmWasm",
  evm: "EVM",
  fuel: "Fuel",
  iota: "IOTA",
  movement: "Movement",
  near: "NEAR",
  solana: "Solana",
  stacks: "Stacks",
  starknet: "Starknet",
  sui: "Sui",
  ton: "TON",
};

const SUPPORTED_SIMPLE = new Set<Chain>(["sui", "solana"]);
const SUPPORTED_PARTIAL = new Set<Chain>(["evm"]);

type Props = { chain: Chain };

const TITLE = "Pyth Core upgrades on August 26, 2026 at 16:00 UTC";

export const UpgradeCallout = ({ chain }: Props) => {
  const upgradeGuide = "/price-feeds/core/upgrade/preparing";
  const upgradedAddressesRoot = "/price-feeds/core/upgrade/contracts";
  const contactMail = "mailto:data@dourolabs.xyz";

  if (chain === "index") {
    return (
      <Callout title={TITLE} type="warn">
        <ul className="list-disc pl-5 my-0! space-y-1">
          <li>
            We recommend new integrations use the{" "}
            <Link href={upgradedAddressesRoot}>
              upgraded contract addresses
            </Link>
            .
          </li>
          <li>
            Existing integrations using the current addresses will be
            automatically upgraded by the DAO on{" "}
            <strong>August 26, 2026 at 16:00 UTC</strong>. See the{" "}
            <Link href={upgradeGuide}>upgrade guide</Link> for details.
          </li>
        </ul>
      </Callout>
    );
  }

  const label = CHAIN_LABELS[chain];
  const upgradedAddresses = `${upgradedAddressesRoot}#${chain}`;

  if (SUPPORTED_SIMPLE.has(chain)) {
    return (
      <Callout
        title={`Pyth Core on ${label} is upgrading on August 26, 2026 at 16:00 UTC`}
        type="warn"
      >
        <ul className="list-disc pl-5 my-0! space-y-1">
          <li>
            We recommend new integrations use the{" "}
            <Link href={upgradedAddresses}>upgraded {label} contracts</Link>.
          </li>
          <li>
            Existing integrations using the current addresses will be
            automatically upgraded by the DAO on{" "}
            <strong>August 26, 2026 at 16:00 UTC</strong>. See the{" "}
            <Link href={upgradeGuide}>upgrade guide</Link> for details.
          </li>
        </ul>
      </Callout>
    );
  }

  if (SUPPORTED_PARTIAL.has(chain)) {
    return (
      <Callout
        title={`Pyth Core on ${label} chains is upgrading on August 26, 2026 at 16:00 UTC`}
        type="warn"
      >
        <ul className="list-disc pl-5 my-0! space-y-1">
          <li>
            We recommend new integrations use the{" "}
            <Link href={upgradedAddresses}>upgraded {label} contracts</Link>.
          </li>
          <li>
            Existing integrations on {label} chains in the upgrade will be
            automatically upgraded by the DAO on{" "}
            <strong>August 26, 2026 at 16:00 UTC</strong>. See the{" "}
            <Link href={upgradeGuide}>upgrade guide</Link> for details.
          </li>
          <li>
            <a href={contactMail}>Contact the team</a> if your chain isn&apos;t
            in the upgrade list.
          </li>
        </ul>
      </Callout>
    );
  }

  return (
    <Callout
      title={`Pyth Core will no longer support ${label} after August 26, 2026 at 16:00 UTC`}
      type="warn"
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
