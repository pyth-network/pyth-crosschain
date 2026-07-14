import { solanaLazerContracts } from "@pythnetwork/contract-manager/utils/utils";
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

const solanaExplorer = (address: string) =>
  `https://explorer.solana.com/address/${address}`;

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
