import type { ComponentProps } from "react";

import { Faq } from "../Faq";
import { ModalDialog } from "../ModalDialog";

export const PublisherFaq = (
  props: Omit<ComponentProps<typeof ModalDialog>, "title" | "children">,
) => (
  <ModalDialog title="Publisher FAQ" {...props}>
    <Faq
      className="px-2"
      questions={[
        {
          question: "Which MDPs can receive delegated stake?",
          answer:
            "Stakers can delegate PYTH tokens to any MDP that is permissioned on Pythnet through Oracle Integrity Staking.",
        },
        {
          question: "What is my incentive to receive delegated stake?",
          answer:
            "Data publishers that have received delegated stake are eligible to earn 5% (delegation fee) of the rewards received by their delegators, provided they have opted-into receiving rewards by declaring their stake account.",
        },
        {
          question: "How do I opt-in to receive rewards?",
          answer: (
            <>
              <p>
                Data publishers that have received locked tokens in the past (in
                the context of publishing rewards like PRP) are automatically
                opted-in with their existing stake account with the most funds
                as their “declared stake account”.
              </p>
              <p>
                Data publishers that have never received locked tokens and are
                interested to opt-in will need to get onboarded. They will be
                opted-out by default.
              </p>
            </>
          ),
        },
        {
          question: "Where are my rewards sent?",
          answer: "They will get sent to your declared stake account.",
        },
        {
          question: "How do I claim my rewards?",
          answer: (
            <>
              <p>
                Rewards from self-stake will appear in the Available Rewards
                bucket on the website.
              </p>
              <p>
                Rewards from delegated-stake will appear in the Unlocked &
                Unstaked bucket on the website.
              </p>
            </>
          ),
        },
        {
          question: "Are rewards unlocked or locked tokens?",
          answer:
            "OIS accepts unlocked tokens, so are the rewards paid by the program",
        },
        {
          question: "When are rewards distributed?",
          answer:
            "Rewards are distributed at the beginning of each Pyth epoch and are calculated based on the state during and performance during the latest complete epoch",
        },
        {
          question: "What is a Pyth epoch?",
          answer:
            "A Pyth epoch has a duration of 7 days and starts every Thursday at 00:00 UTC",
        },
        {
          question: "Can I change stake account?",
          answer: (
            <>
              <p>
                Yes, keep in mind that to be able to change stake account both
                the current and the new stake account may not have any
                integrity-staked tokens. It is possible to change stake accounts
                that have governance-staked tokens.
              </p>
              <p>
                If you want to change your declared stake account at the
                beginning of the program, please do so before staking your
                tokens.
              </p>
            </>
          ),
        },
        {
          question:
            "Can I designate a different stake account as my associated publisher account? Thre",
          answer:
            "Yes, there will be a button in the Self-Stake Section (”designate different account”) that will allow you to designate a different stake account to your associated publisher account.* Please note: You can only perform this action if you have 0 self-staked tokens in OIS.",
        },
        {
          question: "Can I opt-out of all rewards?",
          answer: (
            <>
              <p>
                Any data publisher can opt-out of all rewards at any time. If
                you have been automatically opted-in you have until October the
                3rd 00:00am UTC to opt-out. That’s when the first rewards will
                start getting distributed.
              </p>
              <p>Publishers can’t opt-out of being delegated to.</p>
              <p>
                There will be a button (”Opt-out of rewards”) in the Self-Stake
                Section that will allow you to opt-out of rewards. Please note:
                You can only perform this action if you have 0 self-staked
                tokens in OIS.
              </p>
            </>
          ),
        },
        {
          question: "Why should I stake?",
          answer:
            "Staking as a data publisher makes you eligible to receive 100% of the available rewards. This is 20x the amount of rewards you make as only being an opted-in delegatee.",
        },

        {
          question:
            "If I opt-in to receiving rewards, do I have to stake as well?",
          answer: "No",
        },

        {
          question:
            "Are there any penalties for not participating in Oracle Integrity Staking?",
          answer: "No",
        },

        {
          question:
            "What are the rewards accrued and how are they split between delegatee and delegators.",
          answer:
            "The rewards accrued are a function the publisher’s stake soft cap, the amount of self-stake, and the amount of delegated stake. Self-stake is prioritized with regards to rewards vs delegated staked. For more details link to docs.",
        },

        {
          question: "How is my soft cap calculated?",
          answer:
            "Soft-cap is a function how many symbols you’re permissioned to publish on Pythnet. Being permissioned to a symbol with fewer publishers increases your cap more than being permissioned to a symbol with many publishers. Link to docs.",
        },

        {
          question: "How is the yield generated?",
          answer:
            "The yield is currently subsidized by a grant of 100M PYTH tokens by the PDA.",
        },

        {
          question: "How does slashing take place?",
          answer:
            "Slashing needs to happen in the epoch right after the epoch where the incident happens. The Pythian Council can choose to slash at any time for issues happened in the previous epoch.",
        },

        {
          question: "How much of my stake will I lose in slashing?",
          answer: "5% in the unlikely event of a data quality issue",
        },

        {
          question:
            "Is there a cooldown period for unstaking? If so, how long?",
          answer:
            "There is a cooldown for unstaking of 1 full epoch. This means you will have to wait for the end of the current epoch and then 1 full epoch. This is because you can’t withdraw your funds until the Pythian Council has had one epoch to review the price data during the epoch where your stake was active.",
        },

        {
          question:
            "Would staking affect the PRP award results at all, or is Oracle Integrity Staking considered something categorically separate from the PRP?",
          answer: "These are separate rewards and separate programs",
        },
        {
          question:
            "How is Oracle Integrity Staking different from staking on https://staking.pyth.network/",
          answer: (
            <>
              <p>
                Previously, staking was limited to participation in governance.
                Now, Oracle Integrity Staking is also available. A token can be
                staked in Oracle Integrity Staking and governance staking
                simultaneously and the new website allows managing both types of
                staking.
              </p>
              <p>
                Oracle Integrity Staking is analogous to governance staking with
                3 main differences:
              </p>
              <ul className="mx-10 list-disc">
                <li>Oracle Integrity Staking exposes the users to slashing</li>
                <li>Oracle Integrity Staking is eligible for rewards</li>
                <li>
                  Oracle Integrity Staking doesn’t provide any voting power
                </li>
              </ul>
            </>
          ),
        },
        {
          question:
            "How does delegated staking take place from a community member/retail user perspective",
          answer:
            "Community members use the same portal to stake their tokens.",
        },

        {
          question:
            "Are there any plans to make staking a mandatory requirement to publish data on Pythnet?",
          answer: "Not right now.",
        },

        {
          question:
            "If I dont stake, is there any penalty possible for me as a publisher in case of misprint?",
          answer:
            "There won’t be any direct penalty. However there are reputational risks.",
        },
      ]}
    />
  </ModalDialog>
);
