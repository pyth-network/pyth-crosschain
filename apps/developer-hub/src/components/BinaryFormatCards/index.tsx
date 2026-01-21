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
    id: "evm",
    name: "EVM",
    algorithm: "secp256k1 ECDSA",
    specs: [
      { label: "Hash", value: "Keccak-256" },
      { label: "Signature", value: "65 bytes" },
      { label: "Verification", value: "Recoverable ECDSA" },
    ],
    useCases: [
      "Ethereum",
      "Arbitrum",
      "Optimism",
      "Polygon",
      "BSC",
      "Avalanche",
    ],
    signature: "65 bytes",
    verification: "Recoverable ECDSA",
    use: "Onchain",
  },
  {
    id: "solana",
    name: "Solana",
    algorithm: "Ed25519 EdDSA",
    specs: [
      { label: "Signature", value: "64 bytes" },
      { label: "Public Key", value: "32 bytes" },
      { label: "Verification", value: "Direct Ed25519" },
    ],
    useCases: ["Solana", "Fogo", "Ed25519-native chains"],
    signature: "64 bytes",
    verification: "Direct Ed25519",
    use: "Onchain",
  },
  {
    id: "leEcdsa",
    name: "Little-Endian ECDSA",
    algorithm: "secp256k1 ECDSA (little-endian)",
    specs: [
      { label: "Hash", value: "Keccak-256" },
      { label: "Byte Order", value: "Little-endian" },
      { label: "Verification", value: "Custom impl" },
    ],
    useCases: ["Custom implementations", "Little-endian chains"],
    signature: "65 bytes",
    verification: "Custom implementation",
    use: "Onchain",
  },
  {
    id: "leUnsigned",
    name: "Unsigned",
    algorithm: "None",
    specs: [
      { label: "Signature", value: "None" },
      { label: "Verification", value: "N/A" },
      { label: "Use", value: "Offchain only" },
    ],
    useCases: ["Development", "Testing", "Analytics", "Backend services"],
    note: "No cryptographic signature - for offchain use only",
    signature: "None",
    verification: "N/A",
    use: "Offchain",
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
      <Tabs items={["Compare", "Cards"]} defaultIndex={0}>
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
                <tr key={format.id} className={styles.tableRow}>
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
                key={format.id}
                type="button"
                className={clsx(
                  styles.card,
                  selectedFormat === format.id && styles.selected,
                )}
                onClick={() => {
                  setSelectedFormat(
                    selectedFormat === format.id ? undefined : format.id,
                  );
                }}
              >
                <div className={styles.cardHeader}>
                  <h4 className={styles.formatName}>{format.name}</h4>
                  <span className={styles.algorithm}>{format.algorithm}</span>
                </div>

                <div className={styles.specs}>
                  {format.specs.map((spec) => (
                    <div key={spec.label} className={styles.specRow}>
                      <span className={styles.specLabel}>{spec.label}</span>
                      <span className={styles.specValue}>{spec.value}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.useCases}>
                  <span className={styles.useCasesLabel}>Best for:</span>
                  <div className={styles.useCasesTags}>
                    {format.useCases.map((useCase) => (
                      <span key={useCase} className={styles.tag}>
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
