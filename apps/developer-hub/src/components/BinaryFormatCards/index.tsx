"use client";

import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import clsx from "clsx";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { useState } from "react";

import styles from "./index.module.scss";

export type BinaryFormat = {
  id: string;
  name: string;
  algorithm: string;
  specs: { label: string; value: string }[];
  useCases: string[];
  note?: string;
  signature: string;
  verification: string;
  use: string;
};

const DEFAULT_FORMATS: BinaryFormat[] = [
  {
    algorithm: "secp256k1 ECDSA",
    id: "evm",
    name: "EVM",
    signature: "65 bytes",
    specs: [
      { label: "Hash", value: "Keccak-256" },
      { label: "Signature", value: "65 bytes" },
      { label: "Verification", value: "Recoverable ECDSA" },
    ],
    use: "Onchain",
    useCases: [
      "Ethereum",
      "Arbitrum",
      "Optimism",
      "Polygon",
      "BSC",
      "Avalanche",
    ],
    verification: "Recoverable ECDSA",
  },
  {
    algorithm: "Ed25519 EdDSA",
    id: "solana",
    name: "Solana",
    signature: "64 bytes",
    specs: [
      { label: "Signature", value: "64 bytes" },
      { label: "Public Key", value: "32 bytes" },
      { label: "Verification", value: "Direct Ed25519" },
    ],
    use: "Onchain",
    useCases: ["Solana", "Fogo", "Ed25519-native chains"],
    verification: "Direct Ed25519",
  },
  {
    algorithm: "secp256k1 ECDSA (little-endian)",
    id: "leEcdsa",
    name: "Little-Endian ECDSA",
    signature: "65 bytes",
    specs: [
      { label: "Hash", value: "Keccak-256" },
      { label: "Byte Order", value: "Little-endian" },
      { label: "Verification", value: "Custom impl" },
    ],
    use: "Onchain",
    useCases: ["Custom implementations", "Little-endian chains"],
    verification: "Custom implementation",
  },
  {
    algorithm: "None",
    id: "leUnsigned",
    name: "Unsigned",
    note: "No cryptographic signature - for offchain use only",
    signature: "None",
    specs: [
      { label: "Signature", value: "None" },
      { label: "Verification", value: "N/A" },
      { label: "Use", value: "Offchain only" },
    ],
    use: "Offchain",
    useCases: ["Development", "Testing", "Analytics", "Backend services"],
    verification: "N/A",
  },
];

type BinaryFormatCardsProps = {
  formats?: BinaryFormat[];
};

export function BinaryFormatCards({
  formats = DEFAULT_FORMATS,
}: BinaryFormatCardsProps) {
  const [selectedFormat, setSelectedFormat] = useState<string | undefined>(
    undefined,
  );

  return (
    <div className={styles.container}>
      <Tabs defaultIndex={0} items={["Compare", "Cards"]}>
        <Tab value="Compare">
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th className={styles.tableHeader}>Format</th>
                <th className={styles.tableHeader}>Algorithm</th>
                <th className={styles.tableHeader}>Signature</th>
                <th className={styles.tableHeader}>Verification</th>
                <th className={styles.tableHeader}>Use</th>
                <th className={styles.tableHeader}>Best For</th>
              </tr>
            </thead>
            <tbody>
              {formats.map((format) => (
                <tr className={styles.tableRow} key={format.id}>
                  <td className={styles.tableCell}>
                    <code className={styles.formatCode}>{format.id}</code>
                  </td>
                  <td className={styles.tableCell}>{format.algorithm}</td>
                  <td className={styles.tableCell}>{format.signature}</td>
                  <td className={styles.tableCell}>{format.verification}</td>
                  <td className={styles.tableCell}>{format.use}</td>
                  <td className={styles.tableCell}>
                    <div className={styles.useCasesList}>
                      {format.useCases.join(", ")}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tab>
        <Tab value="Cards">
          <div className={styles.grid}>
            {formats.map((format) => (
              <button
                className={clsx(
                  styles.card,
                  selectedFormat === format.id && styles.selected,
                )}
                key={format.id}
                onClick={() => {
                  setSelectedFormat(
                    selectedFormat === format.id ? undefined : format.id,
                  );
                }}
                type="button"
              >
                <div className={styles.cardHeader}>
                  <h4 className={styles.formatName}>{format.name}</h4>
                  <span className={styles.algorithm}>{format.algorithm}</span>
                </div>

                <div className={styles.specs}>
                  {format.specs.map((spec) => (
                    <div className={styles.specRow} key={spec.label}>
                      <span className={styles.specLabel}>{spec.label}</span>
                      <span className={styles.specValue}>{spec.value}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.useCases}>
                  <span className={styles.useCasesLabel}>Best for:</span>
                  <div className={styles.useCasesTags}>
                    {format.useCases.map((useCase) => (
                      <span className={styles.tag} key={useCase}>
                        {useCase}
                      </span>
                    ))}
                  </div>
                </div>

                {format.note && (
                  <div className={styles.note}>
                    <CheckCircle size={14} weight="bold" />
                    <span>{format.note}</span>
                  </div>
                )}

                <span className={styles.clickHint}>
                  {selectedFormat === format.id
                    ? "Click to collapse"
                    : "Click to see format"}
                </span>
              </button>
            ))}
          </div>

          {selectedFormat && (
            <div className={styles.details}>
              <h4 className={styles.detailsHeader}>
                Request {formats.find((f) => f.id === selectedFormat)?.name}{" "}
                format
              </h4>
              <pre className={styles.codeBlock}>
                <code>{`formats: ["${selectedFormat}"]`}</code>
              </pre>
            </div>
          )}
        </Tab>
      </Tabs>
    </div>
  );
}
