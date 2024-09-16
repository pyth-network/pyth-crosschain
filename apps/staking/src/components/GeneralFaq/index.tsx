import type { ComponentProps } from "react";

import { Faq } from "../Faq";
import { Link } from "../Link";
import { ModalDialog } from "../ModalDialog";

export const GeneralFaq = (
  props: Omit<ComponentProps<typeof ModalDialog>, "title" | "children">,
) => (
  <ModalDialog title="FAQ" {...props}>
    <Faq
      questions={[
        {
          question: "What is OIS?",
          answer: (
            <>
              <p>
                Oracle Integrity Staking is the process by which a PYTH token
                holder assigns some or all of their tokens to a particular data
                publisher in order to increase the quality of the data published
                by such data publisher and thus increase the integrity of Pyth’s
                price feeds. Assigning your tokens to add to a delegatee is
                known as “delegating” your tokens.
              </p>
              <p>
                By staking tokens with one or many data publishers, the token
                holder indicates a degree of trust in the publisher they chose
                to delegate to. The accumulated stake by each data publisher
                acts as “proof” to the network that the data published is of
                good quality. By weighing the collective votes from all
                validators against the proportion of stake that has been
                delegated to them, the network reaches consensus by this Proof
                of Stake.
              </p>
            </>
          ),
        },
        {
          question: "Who can stake into OIS?",
          answer:
            "Anyone who holds unlocked PYTH tokens can stake their unlocked tokens through the Pyth Staking Dashboard to the Oracle Integrity Staking program and or Pyth Governance program at any time.",
        },

        {
          question:
            "How is Oracle Integrity Staking (OIS) different from previous/existing Pyth staking?",
          answer: (
            <p>
              Existing staking program enables PYTH Token holders to participate
              in the governance of Pyth in accordance with the{" "}
              <Link
                className="underline"
                target="_blank"
                href="https://forum.pyth.network/t/about-the-pyth-dao/14"
              >
                Pyth DAO Constitution
              </Link>
              . OIS is an additional program that enables PYTH Token holders to
              secure the integrity of price feeds by staking directly (if you
              are a data publisher) or through delegation of stake to one or
              many data publishers
            </p>
          ),
        },
        {
          question: "What are the risks associated with OIS?",
          answer: (
            <>
              <p>
                OIS includes provisions for dealing with data integrity issues
                that can amount to a “slashing” event. Slashing is a process by
                which some portion of staked tokens (directly by a data
                publisher or delegated to a data publisher) is reduced from the
                total staked amount as a punitive measure for a data integrity
                issue that the impacted data publisher has been found to be
                responsible for.
              </p>
              <p>
                This mechanism incentivises data publishers (also acting as
                delegatees) to provide the highest quality data and avoid
                integrity issues, as less stake committed by and/or delegated to
                a data publisher means that such data publisher then accrues
                fewer rewards. Being slashed can also be seen as a reputational
                risk for retaining current or attracting potential future stake.
              </p>
              <p>
                The presence of slashing also incentivises token holders to only
                delegate their tokens to data publishers they assess to be
                performant, and not to delegate all their tokens to a single or
                small number of publishers.
              </p>
            </>
          ),
        },
        {
          question: "Does OIS increase voting weights?",
          answer:
            "No, delegated stake does NOT impact the voting weight of a delegatee. Staked tokens",
        },

        {
          question: "Does slashing reduce voting weights?",
          answer:
            "If token slashed were also staked for governance purposes, then the voting power is reduced when such stake is reduced by a slashing event",
        },

        {
          question:
            "Does delegation of stake give the data publisher additional powers?",
          answer:
            "No. The data publisher(s) to whom you delegate does NOT get any additional rights over the tokens delegated apart from charging delegation fees on any rewards paid by the program or contributing pro-rata to the amount slashed in the case of a slashing event. Delegation does NOT give the data publisher ownership or control over your tokens.",
        },

        {
          question: "Where can I learn about data publishers?",
          answer: (
            <Link
              className="underline"
              target="_blank"
              href="https://pyth.network/publishers"
            >
              https://pyth.network/publishers
            </Link>
          ),
        },

        {
          question: "Can I stake tokens if my tokens have a lockup schedule?",
          answer:
            "You can only stake unlocked tokens through OIS, as slashing can only operate on unlocked tokens. Staking for Governance supports both locked and unlocked tokens.",
        },
        {
          question: "Where are the rewards coming from?",
          answer:
            "Initially, the reward pool is sponsored by the Pyth Data Association. In the future, the reward pool will collect fees from the usage of the products and protocols that Pyth provides to DeFi",
        },
      ]}
    />
  </ModalDialog>
);
