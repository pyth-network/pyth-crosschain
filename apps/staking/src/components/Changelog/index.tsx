"use client";

import type { ReactNode } from "react";
import { useDateFormatter } from "react-aria";

import { useChangelog } from "../../hooks/use-changelog";
import { Link } from "../Link";
import { ModalDialog } from "../ModalDialog";

export const Changelog = () => {
  const { isOpen, toggleOpen } = useChangelog();

  return (
    <ModalDialog title="Changelog" isOpen={isOpen} onOpenChange={toggleOpen}>
      <ul className="flex max-w-prose flex-col divide-y divide-neutral-600/50">
        {messages.map(({ id, message }) => (
          <li key={id}>{message}</li>
        ))}
      </ul>
    </ModalDialog>
  );
};

type ChangelogMessageProps = {
  date: Date;
  children: ReactNode | ReactNode[];
};

export const ChangelogMessage = ({ date, children }: ChangelogMessageProps) => {
  const dateFormatter = useDateFormatter({
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <section className="py-8">
      <h2 className="text-sm uppercase text-pythpurple-400">
        {dateFormatter.format(date)}
      </h2>
      {children}
    </section>
  );
};

type ChangelogSectionProps = {
  title: ReactNode;
  children: ReactNode | ReactNode[];
};

export const ChangelogSection = ({
  title,
  children,
}: ChangelogSectionProps) => (
  <section className="mt-4">
    <h3 className="text-lg font-semibold text-white">{title}</h3>
    <div className="flex flex-col gap-2 pl-2 text-sm opacity-70">
      {children}
    </div>
  </section>
);

export const messages = [
  {
    id: 1,
    message: (
      <ChangelogMessage date={new Date("2024-10-10")}>
        <ChangelogSection title="Milestones">
          <div>
            <p>
              We are pleased to announce the following Oracle Integrity Staking
              milestones:
            </p>
            <ul className="list-disc pl-8">
              <li>145M PYTH staked and securing DeFi.</li>
              <li>10K unique stakers participating.</li>
              <li>492K in PYTH programmatically distributed.</li>
            </ul>
          </div>
          <p>We’re thrilled to see so many community participants.</p>
        </ChangelogSection>
        <ChangelogSection title="New Features to the Staking Frontend">
          <ul className="list-disc pl-4">
            <li>
              New sort filter for publishers list. Publishers with self-stake
              are displayed first by default. You can sort by publisher details,
              pool composition, and more.
            </li>
            <li>
              Publishers interested in de-anonymizing themselves can have their
              names displayed in the publisher list.
            </li>
            <li>New OIS live stats added to navigation bar.</li>
            <li>
              New dialogue added under “Help” where you can view current program
              parameters.
            </li>
            <li>
              Option to remove PYTH from the smart contract program for parties
              with restricted access to the staking frontend.
            </li>
            <li>
              Full access to Pyth Governance for certain restricted
              jurisdictions.
            </li>
            <li>APYs are now shown as net of delegation fees.</li>
            <li>
              Updates to educational materials (all Guides and FAQs) for clarity
              and readability.
            </li>
            <li>
              New Oracle Integrity Staking{" "}
              <Link
                href="https://forum.pyth.network/c/oracle-integrity-staking-ois-discussion/8"
                className="underline"
                target="_blank"
              >
                discussion catalogue
              </Link>{" "}
              opened in Pyth DAO forum. Let the community know your thoughts and
              feedback!
            </li>
          </ul>
        </ChangelogSection>
        <ChangelogSection title="Security">
          <p>
            The Pyth contributors take security extremely seriously. The
            contract code is{" "}
            <Link
              href="https://github.com/pyth-network/governance/tree/main/staking/programs/staking"
              className="underline"
              target="_blank"
            >
              open source
            </Link>{" "}
            and the upgrade authority is governed by the Pyth DAO. The official{" "}
            <Link
              href="https://github.com/pyth-network/audit-reports/blob/main/2024_09_11/pyth_cip_final_report.pdf"
              className="underline"
              target="_blank"
            >
              audit report
            </Link>{" "}
            is publicly accessible. All on-chain contract codes are verified
            using{" "}
            <Link
              href="https://github.com/Ellipsis-Labs/solana-verifiable-build/"
              className="underline"
              target="_blank"
            >
              Solana verifiable build
            </Link>{" "}
            and the Pyth DAO governs the upgrade authority.
          </p>
        </ChangelogSection>
        <ChangelogSection title="Best Practices">
          <p>
            Please remember that publishers have priority for programmatic
            rewards distributions. By protocol design, if a pool’s stake cap is
            exceeded, the programmatic reward rate for other stakers
            participating in that pool will be lower than the Pyth DAO-set
            maximum reward rate.
          </p>
        </ChangelogSection>
        <ChangelogSection title="Acknowledgements">
          <p>
            The Pyth contributors are glad to see so many network participants
            getting involved with Oracle Integrity Staking to help secure the
            oracle and protect the wider DeFi industry. OIS wouldn’t be possible
            without you!
          </p>
        </ChangelogSection>
        <ChangelogSection title="Feedback">
          <p>
            Please reach out in the official{" "}
            <Link
              href="https://discord.com/invite/PythNetwork"
              className="underline"
              target="_blank"
            >
              Pyth Discord
            </Link>{" "}
            or the{" "}
            <Link
              href="https://forum.pyth.network"
              className="underline"
              target="_blank"
            >
              Pyth DAO Forum
            </Link>{" "}
            to share your questions, ideas, or feedback. We want to hear what
            you think.
          </p>
        </ChangelogSection>
      </ChangelogMessage>
    ),
  },
];
