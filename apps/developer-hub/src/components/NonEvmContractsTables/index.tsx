import {
  solanaLazerContracts,
  suiLazerContracts,
  suiPriceFeedContracts,
} from "@pythnetwork/contract-manager/utils/utils";
import {
  DEFAULT_PUSH_ORACLE_PROGRAM_ID,
  DEFAULT_RECEIVER_PROGRAM_ID,
  DEFAULT_WORMHOLE_PROGRAM_ID,
  PRO_COMPATIBLE_PUSH_ORACLE_PROGRAM_ID,
  PRO_COMPATIBLE_RECEIVER_PROGRAM_ID,
  PRO_COMPATIBLE_WORMHOLE_PROGRAM_ID,
} from "@pythnetwork/pyth-solana-receiver";

import CopyAddress from "../CopyAddress";

const humanize = (chainId: string): string =>
  chainId
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const withHexPrefix = (id: string): string =>
  id.startsWith("0x") ? id : `0x${id}`;

const solanaExplorer = (address: string) =>
  `https://explorer.solana.com/address/${address}`;

const suiExplorer = (network: "mainnet" | "testnet", objectId: string) =>
  `https://suiscan.xyz/${network}/object/${objectId}`;

const SOLANA_CORE_PROGRAMS = [
  {
    current: DEFAULT_WORMHOLE_PROGRAM_ID,
    name: "Wormhole receiver",
    upgraded: PRO_COMPATIBLE_WORMHOLE_PROGRAM_ID,
  },
  {
    current: DEFAULT_RECEIVER_PROGRAM_ID,
    name: "Solana receiver",
    upgraded: PRO_COMPATIBLE_RECEIVER_PROGRAM_ID,
  },
  {
    current: DEFAULT_PUSH_ORACLE_PROGRAM_ID,
    name: "Price feed",
    upgraded: PRO_COMPATIBLE_PUSH_ORACLE_PROGRAM_ID,
  },
];

export const SolanaCoreProgramsTable = () => (
  <table>
    <thead>
      <tr>
        <th>Program</th>
        <th>Pyth Core (current)</th>
        <th>Pyth Core (upgraded)</th>
      </tr>
    </thead>
    <tbody>
      {SOLANA_CORE_PROGRAMS.map((program) => {
        const current = program.current.toBase58();
        const upgraded = program.upgraded.toBase58();
        return (
          <tr key={program.name}>
            <td>{program.name}</td>
            <td>
              <CopyAddress
                address={current}
                maxLength={6}
                url={solanaExplorer(current)}
              />
            </td>
            <td>
              <CopyAddress
                address={upgraded}
                maxLength={6}
                url={solanaExplorer(upgraded)}
              />
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

export const SolanaProTable = () => (
  <table>
    <thead>
      <tr>
        <th>Network</th>
        <th>Pyth Pro</th>
      </tr>
    </thead>
    <tbody>
      {solanaLazerContracts.map((contract) => (
        <tr key={contract.chain}>
          <td>{humanize(contract.chain)}</td>
          <td>
            <CopyAddress
              address={contract.programId}
              url={`https://solscan.io/account/${contract.programId}`}
            />
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const SUI_CURRENT_DEPLOYMENT_TYPE = {
  mainnet: "stable",
  testnet: "beta",
} as const;

export const SuiCoreContractsTable = ({
  network,
}: {
  network: "mainnet" | "testnet";
}) => {
  const chain = `sui_${network}`;
  const current = suiPriceFeedContracts.find(
    (c) =>
      c.chain === chain &&
      c.deploymentType === SUI_CURRENT_DEPLOYMENT_TYPE[network],
  );
  const upgraded = suiPriceFeedContracts.find(
    (c) =>
      c.chain === chain && c.deploymentType === "pro-compatible-production",
  );

  const rows = [
    {
      current: current?.stateId,
      name: "Pyth State ID",
      upgraded: upgraded?.stateId,
    },
    {
      current: current?.wormholeStateId,
      name: "Wormhole State ID",
      upgraded: upgraded?.wormholeStateId,
    },
  ];

  const renderCell = (objectId: string | undefined) =>
    objectId === undefined ? (
      "—"
    ) : (
      <CopyAddress
        address={withHexPrefix(objectId)}
        maxLength={6}
        url={suiExplorer(network, withHexPrefix(objectId))}
      />
    );

  return (
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Pyth Core (current)</th>
          <th>Pyth Core (upgraded)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>{row.name}</td>
            <td>{renderCell(row.current)}</td>
            <td>{renderCell(row.upgraded)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const SuiProTable = () => (
  <table>
    <thead>
      <tr>
        <th>Network</th>
        <th>State Object ID</th>
      </tr>
    </thead>
    <tbody>
      {suiLazerContracts.map((contract) => {
        const network = contract.chain.endsWith("testnet")
          ? "testnet"
          : "mainnet";
        const stateId = withHexPrefix(contract.stateId);
        return (
          <tr key={contract.chain}>
            <td>{humanize(contract.chain)}</td>
            <td>
              <CopyAddress
                address={stateId}
                maxLength={6}
                url={suiExplorer(network, stateId)}
              />
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);
