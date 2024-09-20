import type { ComponentProps } from "react";

import { FaqSection } from "../Faq";
import { Link } from "../Link";
import { ModalDialog } from "../ModalDialog";

export const GeneralFaq = (
  props: Omit<ComponentProps<typeof ModalDialog>, "title" | "children">,
) => (
  <ModalDialog title="FAQ" {...props}>
    <FaqSection
      header="General"
      questions={[
        {
          question: "What is Oracle Integrity Staking (OIS)?",
          answer: (
            <>
              <p>
                The Oracle Integrity Staking (OIS) program is an upgrade to Pyth
                Price Feeds which allows participants to support the security
                and reliability of the Pyth price oracle.
              </p>
              <p>
                In OIS, each Pyth Network publisher is programmatically assigned
                a stake pool. Publishers can stake tokens into those pools to
                become eligible for programmatic rewards, which are tied to the
                accuracy of the price data they provide.
              </p>
              <p>
                When non-publishers stake tokens to a publisher’s pool, that
                stake helps enhance publisher potential rewards, contributing to
                the security of Price Feeds. Rewards are programmatically
                distributed to publishers first, with the remaining rewards
                going to stakers.
              </p>
              <p>
                Learn more by visiting the <strong>Help</strong> section on the
                OIS dashboard or by checking out the{" "}
                <Link
                  href="https://pyth.network/blog/oracle-integrity-staking-incentivizing-safer-price-feeds-for-a-more-secure-defi"
                  className="underline"
                  target="_blank"
                >
                  official announcement
                </Link>
                .
              </p>
            </>
          ),
        },
        {
          question: "Who can participate in OIS?",
          answer:
            "Anyone with PYTH tokens can participate in OIS and interact with its contract. Whether you are a publisher or just someone who wants to help secure the oracle network, you can stake your tokens and become part of the OIS program.",
        },
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
                a publisher or by another participant) is reduced from the total
                staked amount as a punitive measure for a data integrity issue
                that the impacted publisher is responsible for.
              </p>
            </>
          ),
        },
        {
          question:
            "How is OIS different from the previous Pyth staking program?",
          answer: (
            <>
              <p>
                The previous staking program is the Pyth Governance (PG)
                program, which enables PYTH holders to participate in the
                governance of Pyth Network in accordance with the{" "}
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
            "If your tokens are slashed and these tokens were also staked in PG, then your voting power would be reduced by the slashing event",
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
      ]}
    />
    <FaqSection
      header="OIS Parameters"
      questions={[
        {
          question: "Where do staking rewards come from?",
          answer:
            "The current reward pool is sponsored by the Pyth Data Association. In the future, the Pyth DAO can vote to decide on future sources for rewards such as, for example, oracle fees or other on-chain sources.",
        },

        {
          question: "What is the expected rate of rewards?",
          answer:
            "The reward rate is a function of the rewards available in the program, the amount of PYTH that is staked in OIS, and the parameters of the OIS program. The Pyth DAO can vote to adjust these parameters.",
        },

        {
          question: "What is the delegation fee?",
          answer:
            "OIS currently charges a delegation fee for publishers from participants who staked to their pool. The delegation fee is currently set universally at 20%. OIS currently does not support separate fees. The Pyth DAO can vote to change this parameter.",
        },

        {
          question: "When do rewards begin accumulating?",
          answer:
            "Staked tokens which are eligible for programmatic rewards (or slashing) accumulates rewards at the end of each full epoch when the stake becomes effective (post-warmup and not subject to cooldown).",
        },

        {
          question:
            "Are tokens in the Warmup Period eligible for rewards or slashing?",
          answer:
            "No. Tokens in warmup are not subject to rewards and slashing because they are not staked.",
        },
        {
          question:
            "Are tokens in the Cooldown Period eligible for rewards or slashing?",
          answer: (
            <>
              <p>
                The Cooldown Period has two phases: from the time you click{" "}
                <strong>Unstake</strong> until the end of the current epoch,
                followed by a full epoch. Tokens in the first phase are eligible
                for rewards. Tokens in both phases are subject to slashing if an
                issue is identified in an epoch in which they were eligible for
                rewards.
              </p>
            </>
          ),
        },
        {
          question: "Where can I learn about data publishers?",
          answer: (
            <>
              <p>
                You can see the full list of Pyth Network publishers{" "}
                <Link
                  href="https://pyth.network/publishers"
                  className="underline"
                  target="_blank"
                >
                  here
                </Link>
                . You can learn more about how Pyth Price Feeds work by visiting
                the{" "}
                <Link
                  href="https://docs.pyth.network/price-feeds/how-pyth-works"
                  className="underline"
                  target="_blank"
                >
                  docs
                </Link>
                .
              </p>
            </>
          ),
        },
        {
          question: "How are publisher quality rankings calculated?",
          answer: (
            <>
              <p>
                Quality rankings are calculated based on a publisher’s price
                deviation, uptime, and price staleness. You can learn more about
                quality ranking calculations{" "}
                <Link
                  href="https://docs.pyth.network/home/oracle-integrity-staking/publisher-quality-ranking"
                  className="underline"
                  target="_blank"
                >
                  here
                </Link>
                .
              </p>
            </>
          ),
        },
        {
          question: "Can the Pyth DAO change the parameters of OIS?",
          answer:
            "Yes. Changes to important parameters such as stake cap inputs, delegation fees, slashing amounts, and more are subject to Operational Pyth Improvement Proposals that any PYTH token holder can raise for the consideration of the Pyth DAO.",
        },
      ]}
    />
  </ModalDialog>
);
