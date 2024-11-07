import type { ComponentProps } from "react";

import { FaqSection } from "../Faq";
import { Link } from "../Link";
import { ModalDialog } from "../ModalDialog";

export const PublisherFaq = (
  props: Omit<ComponentProps<typeof ModalDialog>, "title" | "children">,
) => (
  <ModalDialog title="Publisher FAQ" {...props}>
    <FaqSection
      header="Preparation"
      questions={[
        {
          question:
            "Is there a Market Data Publisher (MDP) specific guide or tutorial?",
          answer: (
            <>
              <p>
                For a comprehensive walkthrough of the OIS program, publishers
                can refer to the{" "}
                <Link
                  href="https://pyth-network.notion.site/Oracle-Integrity-Staking-OIS-Guide-for-Pyth-Network-MDPs-2755c872a7c44aefabfa9987ba7ec8ae?pvs=4"
                  className="underline"
                  target="_blank"
                >
                  OIS Guide for MDPs
                </Link>
                . It is highly recommended to read this guide first.
              </p>
              <p>
                For a guide on the OIS parameters and reward calculations,
                publishers can refer to the{" "}
                <Link
                  href="https://docs.pyth.network/home/oracle-integrity-staking"
                  className="underline"
                  target="_blank"
                >
                  OIS Documentation
                </Link>
                .
              </p>
              <p>
                For an explanation of slashing events and their conditions,
                publishers can refer to the{" "}
                <Link
                  href="https://docs.pyth.network/home/oracle-integrity-staking/slashing-rulebook#slashing-conditions"
                  className="underline"
                  target="_blank"
                >
                  Slashing Rulebook
                </Link>
                .
              </p>
            </>
          ),
        },
        {
          question: "Is participation in OIS mandatory?",
          answer:
            "Participation in OIS as a publisher is optional and voluntary. If you choose not to participate in OIS, you do not need to perform any actions in addition to your regular publisher activities. There are no penalties for choosing not to participate in OIS.",
        },
        {
          question:
            "Are there penalties for data publishers for choosing not to participate in OIS?",
          answer:
            "No. There are no penalties imposed on data publishers for choosing not to participate in OIS.",
        },
        {
          question:
            "Does participating in OIS affect my participation in other Pyth Network publisher programs?",
          answer:
            "No, participating in Oracle Integrity Staking (OIS) does not affect your involvement in any other Pyth Network publisher incentive programs. Your performance and earnings in these programs are completely separate from the OIS program. Likewise, participating in other publisher programs does not impact your participation or potential rewards you would earn in the OIS program.",
        },
        {
          question: "Which MDPs can participate in OIS?",
          answer:
            "All publishers can choose to participate in OIS. All publishers are already assigned a stake pool for OIS.",
        },

        {
          question: "How do I opt in to receive OIS rewards as an MDP?",
          answer: (
            <>
              <p>
                Publishers that have locked tokens are{" "}
                <strong>automatically opted-in</strong> with their main stake
                account, which is the stake account in which they last received
                locked tokens.
              </p>
              <p>
                Publishers that have never received locked tokens will be
                opted-out by default. The opt-in process for these publishers
                will be announced later.
              </p>
              <p>
                If you wish to opt out of rewards, please follow the{" "}
                <Link
                  href="https://pyth-network.notion.site/Oracle-Integrity-Staking-OIS-Guide-for-Pyth-Network-MDPs-2755c872a7c44aefabfa9987ba7ec8ae?pvs=4"
                  className="underline"
                  target="_blank"
                >
                  OIS Guide for MDPs
                </Link>{" "}
                and follow the <strong>Opt Out of Rewards</strong> section.
              </p>
            </>
          ),
        },
        {
          question: "How do I opt out of receiving OIS rewards as an MDP?",
          answer: (
            <>
              <p>
                If you choose <strong>not</strong> to participate in OIS{" "}
                <em>and</em> you need to ensure that the main stake account
                assigned to your publisher key does <strong>not</strong> receive
                any rewards, you must opt out of OIS rewards before Thursday,
                October 3, 2024 (00:00 UTC).
              </p>
              <p>
                Please follow the{" "}
                <Link
                  href="https://pyth-network.notion.site/Oracle-Integrity-Staking-OIS-Guide-for-Pyth-Network-MDPs-2755c872a7c44aefabfa9987ba7ec8ae?pvs=4"
                  className="underline"
                  target="_blank"
                >
                  OIS Guide for MDPs
                </Link>{" "}
                and follow the <strong>Opt Out of Rewards</strong> section.
              </p>
            </>
          ),
        },
        {
          question:
            "If I opt in to receiving OIS rewards, do I have to stake as well?",
          answer:
            "No. You are not obligated to stake to OIS, even if you remain opted in for OIS rewards.",
        },
        {
          question:
            "Does opting in make me subject to both the staking rewards and slashing mechanisms?",
          answer: (
            <>
              <p>
                Opting-in makes you subject to staking rewards from delegate
                stakers but does not make you subject to slashing unless you
                stake to your own stake pool.
              </p>
              <p>
                Programmatic rewards for staking for publishers are determined
                by a number of stake pool parameters. Programmatic slashing is
                capped at a 5% percentage amount of the total stake within a
                publisher’s stake pool. The Pyth DAO can vote to adjust these
                parameters.
              </p>
              <p>
                Please refer to the{" "}
                <Link
                  href="https://docs.pyth.network/home/oracle-integrity-staking"
                  className="underline"
                  target="_blank"
                >
                  OIS Documentation
                </Link>{" "}
                for the requirements, rules, and calculations for these
                mechanisms.
              </p>
            </>
          ),
        },
      ]}
    />
    <FaqSection
      header="Understanding OIS"
      questions={[
        {
          question: "What are the risks associated with OIS?",
          answer: (
            <>
              <p>
                OIS includes provisions for dealing with data integrity issues
                that can amount to a slashing event.
              </p>
              <p>
                Slashing is a process in which some portion of staked tokens (by
                a publisher or by another participant) is slashed as a punitive
                measure for a data integrity issue that the impacted publisher
                is responsible for.
              </p>
              <p>
                It is important to understand the requirements,
                responsibilities, and implications of participating in OIS. The{" "}
                <Link
                  href="https://pyth-network.notion.site/Oracle-Integrity-Staking-OIS-Guide-for-Pyth-Network-MDPs-2755c872a7c44aefabfa9987ba7ec8ae?pvs=4"
                  className="underline"
                  target="_blank"
                >
                  OIS Guide for MDPs
                </Link>{" "}
                offers a quick guide on understanding whether OIS is right for
                you.
              </p>
            </>
          ),
        },
        {
          question:
            "I have previously staked in Pyth Governance (the previous program found on staking.pyth.network). Is OIS the same program?",
          answer: (
            <>
              <p>
                No. The program available on{" "}
                <Link
                  href="http://staking.pyth.network"
                  className="underline"
                  target="_blank"
                >
                  staking.pyth.network
                </Link>{" "}
                before Sep 21, 2024 is the Pyth Governance (PG) program, which
                enables PYTH holders to participate in the governance of Pyth
                Network in accordance with the{" "}
                <Link
                  href="https://github.com/pyth-network/governance/blob/main/docs/constitution/pyth-dao-constitution.md"
                  className="underline"
                  target="_blank"
                >
                  Pyth DAO Constitution
                </Link>
                .
              </p>
              <p>
                Oracle Integrity Staking (OIS) is a new and separate program.
                OIS enables PYTH holders to improve the integrity of Pyth Price
                Feeds through decentralized staking and slashing mechanisms.
              </p>
            </>
          ),
        },
        {
          question:
            "Can I participate in both Oracle Integrity Staking (OIS) and Pyth Governance (PG)?",
          answer:
            "Yes. You can participate in OIS, PG, both, or neither programs. The same PYTH token can be staked simultaneously in OIS and PG in any order. To withdraw your tokens back to your wallet, the tokens must be unstaked from both OIS and PG.",
        },

        {
          question: "Does participating in OIS affect my participation in PG?",
          answer:
            "No. The two programs are separate. Staking in OIS does not affect your participation in PG. For example, staking in OIS does not increase your voting power in PG. Staking to a publisher’s stake pool does not give that publisher additional voting power in PG.",
        },

        {
          question: "Does slashing reduce voting weights?",
          answer:
            "If your tokens are slashed and these tokens were also staked in PG, then your voting power would be reduced insofar that the slashing event reduces the total amount of tokens that were staked in both OIS and PG.",
        },
        {
          question: "Can I stake tokens if my tokens have a lockup schedule?",
          answer: (
            <>
              <p>
                You can only stake unlocked tokens in OIS, as slashing can only
                operate on unlocked tokens. However, you can stake in Pyth
                Governance using both locked and unlocked tokens.
              </p>
              <p>
                You can use the Pyth Staking Dashboard to see your lockup
                schedule.
              </p>
            </>
          ),
        },
        {
          question: "Are OIS rewards unlocked or locked tokens?",
          answer:
            "In its current design, OIS rewards come in the form of unlocked PYTH tokens.",
        },
        {
          question: "When are OIS rewards distributed?",
          answer: (
            <>
              <p>
                OIS rewards are calculated and distributed at the beginning of
                each new epoch and are calculated based on the state and
                performance of the previous epoch.
              </p>
              <p>
                Please refer to the{" "}
                <Link
                  href="https://docs.pyth.network/home/oracle-integrity-staking"
                  className="underline"
                  target="_blank"
                >
                  OIS documentation
                </Link>{" "}
                for more details.
              </p>
            </>
          ),
        },
        {
          question:
            "Where can I find my OIS rewards and accumulated delegation fees?",
          answer: (
            <p>
              The rewards and delegation fees from other participants in the
              stake pool assigned to you will accumulate in your
              <strong>Unlocked & Unstaked</strong> balance. All rewards under
              this balance can be withdrawn immediately.
            </p>
          ),
        },
        {
          question: "Does OIS affect other publisher reward programs?",
          answer:
            "No. OIS is a separate program and set of rewards from the other publisher reward programs.",
        },
      ]}
    />
    <FaqSection
      header="Getting Started"
      questions={[
        {
          question: "Which wallet should I connect?",
          answer: (
            <>
              <p>
                While publishers can use any wallet address and stake account
                for OIS, it is recommended that you connect the wallet that
                holds your main stake account.
              </p>
              <p>
                Your main stake account is the stake account where you last
                received locked tokens from publishing rewards. (The latest
                rewards were distributed in August 2024).
              </p>
              <p>
                Please refer to the{" "}
                <Link
                  href="https://pyth-network.notion.site/Oracle-Integrity-Staking-OIS-Guide-for-Pyth-Network-MDPs-2755c872a7c44aefabfa9987ba7ec8ae?pvs=4"
                  className="underline"
                  target="_blank"
                >
                  OIS Guide for MDPs
                </Link>{" "}
                for more details.
              </p>
            </>
          ),
        },
        {
          question: "How do I know if I have connected my main stake account?",
          answer: (
            <>
              <p>
                In the upper-right corner of the homepage, click your wallet
                address and hover over <strong>Select stake account</strong>. If
                your main stake account is connected, its address will appear
                under the <strong>Main Account</strong> header and will be
                highlighted.
              </p>
              <p>
                Please refer to the{" "}
                <Link
                  href="https://pyth-network.notion.site/Oracle-Integrity-Staking-OIS-Guide-for-Pyth-Network-MDPs-2755c872a7c44aefabfa9987ba7ec8ae?pvs=4"
                  className="underline"
                  target="_blank"
                >
                  OIS Guide for MDPs
                </Link>{" "}
                for more details.
              </p>
            </>
          ),
        },
        {
          question:
            "Can I reassign a different stake account as my main stake account?",
          answer: (
            <>
              <p>
                Yes. You can reassign a different stake account as your main
                stake account. First, connect your old main stake account. Then
                proceed to the{" "}
                <strong>Oracle Integrity Staking (OIS) tab</strong>. Find your{" "}
                <strong>Self-Staking Section</strong> and click{" "}
                <strong>Reassign Stake Account</strong>.
              </p>
              <p>
                Please note that in order to reassign your{" "}
                <strong>main stake account</strong>, both the current{" "}
                <strong>main stake account</strong> and new stake account cannot
                have any tokens staked in OIS.
              </p>
              <p>
                Please refer to the{" "}
                <Link
                  href="https://pyth-network.notion.site/Oracle-Integrity-Staking-OIS-Guide-for-Pyth-Network-MDPs-2755c872a7c44aefabfa9987ba7ec8ae?pvs=4"
                  className="underline"
                  target="_blank"
                >
                  OIS Guide for MDPs
                </Link>{" "}
                for more details.
              </p>
            </>
          ),
        },
        {
          question: "How do I start staking as an MDP?",
          answer: (
            <>
              <p>
                Please refer to the{" "}
                <Link
                  href="https://pyth-network.notion.site/Oracle-Integrity-Staking-OIS-Guide-for-Pyth-Network-MDPs-2755c872a7c44aefabfa9987ba7ec8ae?pvs=4"
                  className="underline"
                  target="_blank"
                >
                  OIS Guide for MDPs
                </Link>{" "}
                for a comprehensive guide on how to use OIS.
              </p>
              <p>
                You can also find a quick visual guide by proceeding to the{" "}
                <strong>Oracle Integrity Staking (OIS) tab</strong> in the Pyth
                Staking Dashboard homepage and clicking <strong>Help</strong>.
              </p>
            </>
          ),
        },
      ]}
    />
    <FaqSection
      header="Staking and Slashing"
      questions={[
        {
          question: "How are staking rewards calculated and distributed?",
          answer: (
            <>
              <p>
                By staking tokens to your pool as a publisher, you can become
                eligible for on-chain rewards for your published data. Rewards
                for each stake pool are generated at the end of every epoch.
              </p>
              <p>
                The OIS program first distributes rewards to publishers, with
                any remaining rewards going to the stakers who supported those
                publishers. Additionally, as a publisher, you earn delegation
                fees from the rewards to your pool.
              </p>
              <p>
                For a detailed breakdown, you can refer to these{" "}
                <Link
                  href="https://docs.pyth.network/home/oracle-integrity-staking/examples"
                  className="underline"
                  target="_blank"
                >
                  reward calculation examples
                </Link>
                .
              </p>
            </>
          ),
        },
        {
          question: "What factors affect my reward potential as an MDP?",
          answer: (
            <>
              <p>
                The total amount of rewards a stake pool generates is determined
                by the total number of tokens staked in the pool (by both the
                publisher and stakers).
              </p>
              <p>
                The reward amount increases with the size of the total stake, up
                to a limit called the <strong>stake cap</strong>. The stake cap
                is a function how many symbols you are permissioned to publish
                on Pythnet. The increase in the cap for adding a new symbol is
                inversely proportional to the number of publishers supporting
                it.
              </p>
              <p>
                For a detailed explanation, you can refer to the{" "}
                <Link
                  href="https://docs.pyth.network/home/oracle-integrity-staking"
                  className="underline"
                  target="_blank"
                >
                  OIS documentation
                </Link>
                .
              </p>
            </>
          ),
        },
        {
          question: "What is the source of OIS rewards?",
          answer: (
            <>
              <p>
                This initial set of OIS rewards is bootstrapped by Pyth Data
                Association. Please refer to the{" "}
                <Link
                  href="https://pyth.network/blog/oracle-integrity-staking-incentivizing-safer-price-feeds-for-a-more-secure-defi"
                  className="underline"
                  target="_blank"
                >
                  official announcemen
                </Link>
                t for more information.
              </p>
            </>
          ),
        },
        {
          question: "What triggers a slashing event?",
          answer: (
            <>
              <p>
                Anyone can choose to raise a report for a plausible data
                misprint. The Pythian Council of the Pyth DAO will then review
                the reference data provided and compare against the Pyth data to
                determine whether a slashing event should occur.
              </p>
              <p>
                The council will have until the end of the epoch after the epoch
                of the reported incident to review the report. The tokens
                subject to slashing are the tokens eligible for rewards{" "}
                <em>during the epoch of the misprint incident</em>.
              </p>
              <p>
                If a discrepancy is confirmed, a slashing event is triggered. In
                this event, the stakes of publishers who contributed to the
                incorrect aggregate will be programmatically slashed, along with
                the stakes of anyone who delegated tokens towards their stake
                pools.
              </p>
              <p>
                Slashed amounts are sent to the DAO wallet. The Pyth DAO can
                choose to vote on future decisions for these slashed amounts.
              </p>
              <p>
                Please refer to the{" "}
                <Link
                  href="https://docs.pyth.network/home/oracle-integrity-staking/slashing-rulebook"
                  className="underline"
                  target="_blank"
                >
                  Slashing Rulebook
                </Link>{" "}
                for more details.
              </p>
            </>
          ),
        },
        {
          question: "What is the slashing penalty rate?",
          answer:
            "The current slashing rate is capped at 5% of a pool’s total stake. The Pyth DAO can vote to adjust this rate.",
        },
      ]}
    />
  </ModalDialog>
);
