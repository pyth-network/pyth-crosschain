import type { ComponentProps } from "react";

import addPythTokens from "./add-pyth-tokens.png";
import changingWallets from "./changing-wallets.png";
import epochs from "./epochs.png";
import governanceForum from "./governance-forum.png";
import proposalResults from "./proposal-results.png";
import stakedTokens from "./staked-tokens.png";
import totalBalance from "./total-balance.png";
import understandingRealms from "./understanding-realms.png";
import warmupPeriods from "./warmup-periods.png";
import { Guide } from "../Guide";
import { Link } from "../Link";
import Safebox from "../NoWalletHome/safebox.svg";
import SelectPublishers from "../NoWalletHome/select-publishers.svg";
import TokenWarmup from "../NoWalletHome/token-warmup.svg";

export const GovernanceGuide = (
  props: Omit<ComponentProps<typeof Guide>, "title" | "description" | "steps">,
) => (
  <Guide
    title="Pyth Governance Guide"
    description={
      <p>
        Pyth Governance lets the community influence the direction of the Pyth
        Network by voting on key proposals. By staking tokens, community members
        can gain a say in decisions that shape the network’s operations and
        development, ensuring Pyth Network evolves effectively and aligns with
        DeFi’s needs.
      </p>
    }
    steps={[
      {
        title: "Add Tokens",
        icon: Safebox,
        description: (
          <>
            <p>
              Start by adding your PYTH tokens into the Pyth Staking Dashboard.
              Tokens added to the Pyth Staking Dashboard can be staked with the
              Pyth Governance program for voting rights, or with Oracle
              Integrity Staking to help secure the oracle.
            </p>
            <p>
              You can participate in one, the other, or both programs
              simultaneously. Your tokens are stored on a smart contract program
              and are not held by any centralized party.
            </p>
          </>
        ),
        subTabs: [
          {
            title: "Add PYTH Tokens",
            image: addPythTokens,
            description: (
              <>
                <p>
                  Click Add Tokens at the top of the dashboard. You will be
                  prompted to specify how many PYTH tokens you wish to add from
                  your connected wallet.
                </p>

                <p>
                  (Added tokens are stored on the Pyth Staking smart contract
                  program. They are not held by a centralized party or
                  custodian.)
                </p>
              </>
            ),
          },
          {
            title: "Total Balance",
            image: totalBalance,
            description: (
              <p>
                The Total Balance displays the number of tokens you have added
                which can be staked in the Pyth Governance program, the Oracle
                Integrity Staking program, or both.
              </p>
            ),
          },
          {
            title: "Changing Wallets",
            image: changingWallets,
            description: (
              <p>
                You can change your wallet by clicking on your displayed wallet
                address at the top of the dashboard. The Total Balance
                associated with the new wallet will be displayed.
              </p>
            ),
          },
        ],
        faq: {
          title: "Adding Tokens FAQ",
          questions: [
            {
              question: "Why do I need to add my tokens?",
              answer:
                "Adding tokens to the Pyth Staking Dashboard transfers them to your SPL wallet’s staking account. Your tokens will remain under your control on-chain through the Pyth Staking Dashboard.",
            },
            {
              question: "Where are my added tokens stored?",
              answer:
                "Added tokens are stored on the Pyth Staking contract, which resides on-chain. The contract code is open source and the upgrade authority is governed by the Pyth DAO. No centralized party holds your tokens or controls the smart contract code.",
            },
            {
              question:
                "Can I stake the same tokens to both Pyth Governance and Oracle Integrity Staking?",
              answer:
                "Yes, the same PYTH tokens can be staked in both the Pyth Governance and Oracle Integrity Staking programs. Tokens previously staked to Pyth Governance will appear in your Total Balance and can also be staked with Oracle Integrity Staking.",
            },
            {
              question:
                "Why do I need to pay a rent fee when I click Add Tokens?",
              answer:
                'When you first add tokens into the Pyth Staking Dashboard, your wallet needs to create a staking account. This involves a one-time fee called "rent" to cover the cost of account creation. Your wallet will notify you of this fee before you confirm the transaction.',
            },
          ],
        },
      },
      {
        title: "Token Warmup",
        icon: TokenWarmup,
        description: (
          <>
            <p>
              Navigate to the Pyth Governance tab to begin the governance
              staking process. Once you confirm your choice to stake tokens for
              Pyth Governance, you can initiate the process by clicking Stake
              and specifying how many tokens you wish to stake.
            </p>

            <p>
              These tokens will first go through a Warmup Period. The Warmup
              Period lasts the remainder of the current epoch. An epoch is one
              week starting every Thursday at 00:00 AM UTC. Tokens in the Warmup
              Period do not give voting power. Once the Warmup Period concludes,
              these tokens will become staked and confer voting power.
            </p>
          </>
        ),
        subTabs: [
          {
            title: "Warmup Periods",
            description: (
              <>
                <p>
                  When you designate tokens towards staking, they will enter
                  warmup. Warmup Periods last for the remainder of the current
                  epoch. These tokens will become staked is at the start of the
                  next epoch.
                </p>

                <p>
                  Warmup Periods help facilitate a smooth and functioning
                  protocol.
                </p>
              </>
            ),
            image: warmupPeriods,
          },
          {
            title: "Epochs",
            description: (
              <p>
                Pyth Governance runs in epochs to ensure a safe and orderly
                process. Epochs are a fixed period of time lasting for one week
                and beginning every Thursday at 00:00 AM UTC. Warmup Periods
                last for one epoch at most.
              </p>
            ),
            image: epochs,
          },
          {
            title: "Staked Tokens",
            description: (
              <p>
                Tokens that complete the Warmup Period become officially staked
                and will confer you voting power for Pyth Improvement Proposals
                on the{" "}
                <Link
                  className="underline"
                  target="_blank"
                  href="https://app.realms.today/dao/PYTH"
                >
                  Pyth Network Realm
                </Link>
                .
              </p>
            ),
            image: stakedTokens,
          },
        ],
        faq: {
          title: "Warmup FAQ",
          questions: [
            {
              question:
                "Do all tokens committed to staking enter the same Warmup Period?",
              answer:
                "Yes, all tokens you designate to staking will enter the same Warmup Period. For example, if you delegate 1 PYTH token on Monday to Pyth Governance, and you delegate 1 PYTH token on Tuesday to Pyth Governance, you will have 2 PYTH tokens undergoing the same Warmup Period.",
            },
            {
              question: "Can I remove my tokens from the Warmup Period?",
              answer:
                "Yes, you can cancel tokens in the Warmup Period. Simply go to the Governance window and press Cancel under Warmup. You can choose how many tokens you wish to cancel from the staking process.",
            },
            {
              question: "Do tokens in the Warmup Period provide voting power?",
              answer:
                "No, you must wait for tokens in the Warmup Period to become officially Staked in order for them to confer voting power.",
            },
          ],
        },
      },
      {
        title: "Vote & Govern",
        icon: SelectPublishers,
        description: (
          <p>
            To vote on Pyth Improvement Proposals (PIPs), go to the{" "}
            <Link
              className="underline"
              target="_blank"
              href="https://app.realms.today/dao/PYTH"
            >
              Realms page for the Pyth DAO
            </Link>
            . Connect your wallet, select a proposal from the Proposals tab, and
            review its details. The voting interface will show your voting
            status, current results, and the proposal’s quorum threshold. You
            can vote Yes to support or No to oppose the proposal. You will have
            voting power proportional to the amount of tokens you have staked in
            the Pyth Governance program.
          </p>
        ),
        subTabs: [
          {
            title: "Governance Forum",
            description: (
              <p>
                You can join discussions and propose new Operational and
                Constitutional PIPs on the{" "}
                <Link
                  className="underline"
                  target="_blank"
                  href="https://forum.pyth.network"
                >
                  Pyth Governance Forum
                </Link>{" "}
                on Discourse. Successful forum proposals that pass temperature
                checks can be turned into on-chain proposals on Realms. Please
                review the proposal creation and submission guidelines{" "}
                <Link
                  className="underline"
                  target="_blank"
                  href="https://forum.pyth.network/t/read-first-about-pyth-improvement-proposals-pips/24"
                >
                  here
                </Link>
                .
              </p>
            ),
            image: governanceForum,
          },
          {
            title: "Understanding Realms",
            description: (
              <p>
                Pyth Governance uses Realms, a Solana-based platform, for voting
                on PIPs. In the{" "}
                <Link
                  className="underline"
                  target="_blank"
                  href="https://app.realms.today/dao/PYTH"
                >
                  Pyth Network Realm
                </Link>
                , you can view all completed proposals and vote on pending ones.
                Proposals are open for voting for seven days, starting from the
                creation of the proposal. Eligible voters are those from the
                epoch when the proposal started.
              </p>
            ),
            image: understandingRealms,
          },
          {
            title: "Proposal Results",
            description: (
              <p>
                The{" "}
                <Link
                  className="underline"
                  target="_blank"
                  href="https://app.realms.today/dao/PYTH"
                >
                  Pyth Network Realm
                </Link>{" "}
                interface will indicate whether a proposal has met the quorum by
                the end of the voting period. Successful proposals will be
                executed and implemented at the end of the epoch, with any
                attached on-chain instructions being carried out automatically.
                Learn more about the goals and design of Pyth Governance in this{" "}
                <Link
                  className="underline"
                  target="_blank"
                  href="https://www.pyth.network/blog/permissionless-mainnet-token-led-governance-are-live"
                >
                  blog post
                </Link>
                .
              </p>
            ),
            image: proposalResults,
          },
        ],
        faq: {
          title: "Governance & Voting FAQ",
          questions: [
            {
              question: "How much voting power do staked PYTH tokens confer?",
              answer: (
                <p>
                  All staked tokens have equal voting power, but the voting
                  power of each token is inversely proportional to the total
                  number of tokens staked in Pyth Governance. For example, if
                  100 PYTH tokens are staked, each token represents 1% of the
                  voting power. If 1,000 PYTH tokens are staked, each token
                  represents 0.1% of the voting power. For more details, refer
                  to the{" "}
                  <Link
                    className="underline"
                    target="_blank"
                    href="https://github.com/pyth-network/governance/blob/main/docs/constitution/pyth-dao-constitution.md"
                  >
                    Pyth DAO constitution
                  </Link>
                  .
                </p>
              ),
            },
            {
              question: "What are Pyth Improvement Proposals (PIPs)?",
              answer: (
                <p>
                  PIPs are the primary methods to introduce, discuss and
                  implement changes to the Pyth DAO Constitution, governance,
                  and operations. They come in two types: Operational and
                  Constitutional. All PIPs must comply with the{" "}
                  <Link
                    className="underline"
                    target="_blank"
                    href="https://ipfs.io/ipfs/QmP2GmL1n2WbHd7AtHqyXVWFyyHH36aZLfVZbNoqhommJi"
                  >
                    Pyth DAO LLC Operating Agreement
                  </Link>{" "}
                  and applicable laws. Learn more about PIPs in the{" "}
                  <Link
                    className="underline"
                    target="_blank"
                    href="https://github.com/pyth-network/governance/blob/main/docs/constitution/pyth-dao-constitution.md"
                  >
                    Pyth DAO Constitution
                  </Link>
                  .
                </p>
              ),
            },
            {
              question: "How can I submit a PIP?",
              answer: (
                <p>
                  You can submit a PIP through the{" "}
                  <Link
                    className="underline"
                    target="_blank"
                    href="https://forum.pyth.network/"
                  >
                    Pyth Governance Forum
                  </Link>{" "}
                  before it can proceed to on-chain voting on Realms. The
                  submission process and requirements are detailed in{" "}
                  <Link
                    className="underline"
                    target="_blank"
                    href="https://forum.pyth.network/t/read-first-about-pyth-improvement-proposals-pips/24"
                  >
                    this forum post
                  </Link>
                  .
                </p>
              ),
            },
            {
              question:
                "Does voting on Pyth Improvement Proposals earn rewards?",
              answer: (
                <p>
                  No, voting on PIPs does not earn rewards. Voting is a way for
                  members to influence and guide the Pyth Network.{" "}
                  <Link
                    className="underline"
                    target="_blank"
                    href="https://www.pyth.network/blog/permissionless-mainnet-token-led-governance-are-live"
                  >
                    Learn more
                  </Link>
                  .
                </p>
              ),
            },
          ],
        },
      },
    ]}
    {...props}
  />
);
