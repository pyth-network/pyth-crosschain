import type { ComponentProps } from "react";

import addPythTokens from "./add-pyth-tokens.png";
import availableRewards from "./available-rewards.png";
import changingWallets from "./changing-wallets.png";
import claimingRewards from "./claiming-rewards.png";
import cooldownPeriods from "./cooldown-periods.png";
import epochs from "./epochs.png";
import publisherQuality from "./publisher-quality.png";
import selectingPublishers from "./selecting-publishers.png";
import slashing from "./slashing.png";
import stakedTokens from "./staked-tokens.png";
import stakingRewards from "./staking-rewards.png";
import totalBalance from "./total-balance.png";
import unlockedAndUnstaked from "./unlocked-and-unstaked.png";
import warmupPeriods from "./warmup-periods.png";
import { Guide } from "../Guide";
import { Link } from "../Link";
import ObtainRewards from "../NoWalletHome/obtain-rewards.svg";
import Safebox from "../NoWalletHome/safebox.svg";
import SelectPublishers from "../NoWalletHome/select-publishers.svg";
import TokenWarmup from "../NoWalletHome/token-warmup.svg";

export const OracleIntegrityStakingGuide = (
  props: Omit<ComponentProps<typeof Guide>, "title" | "description" | "steps">,
) => (
  <Guide
    title="Oracle Integrity Staking (OIS) Guide"
    description={
      <p>
        OIS allows anyone to help secure Pyth and protect DeFi. Through
        decentralized staking rewards and slashing, OIS incentivizes Pyth
        publishers to maintain high-quality data contributions. PYTH holders can
        stake to publishers to further reinforce oracle security. Rewards are
        programmatically distributed to high quality publishers and the stakers
        supporting them to strengthen oracle integrity.
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
              Oracle Integrity Staking program to help secure the oracle, or
              with Pyth Governance to obtain voting rights.
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
                which can be staked in the Oracle Integrity Staking program, the
                Pyth Governance program, or both.
              </p>
            ),
          },
          {
            title: "Changing Wallets",
            image: changingWallets,
            description: (
              <p>
                You can change your wallet by clicking on your displayed wallet
                address at the top of the dashboard. The Total Balance and
                amounts staked with any publishers associated with the new
                wallet will be displayed.
              </p>
            ),
          },
          {
            title: "Unlocked & Unstaked",
            image: unlockedAndUnstaked,
            description: (
              <p>
                This balance refers to the amount of (unlocked) tokens that are
                not staked in either Oracle Integrity Staking or Pyth
                Governance. (Locked tokens refer to tokens that have not
                vested.) <strong>Unlocked & Unstaked</strong> tokens are
                therefore tokens you can withdraw at any time.
              </p>
            ),
          },
          {
            title: "Available Rewards",
            image: availableRewards,
            description: (
              <p>
                This balance refers to your total accumulated amount of tokens
                programmatically rewarded for participating in Oracle Integrity
                Staking. <strong>Available Rewards</strong> can be claimed at
                any time. Claimed rewards will move to the{" "}
                <strong>Unlocked & Unstaked</strong> balance.
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
        title: "Select Publishers",
        icon: SelectPublishers,
        description: (
          <>
            <p>
              Navigate to the Oracle Integrity Staking tab to begin staking your
              tokens to publishers to help secure Pyth Price Feeds.
            </p>

            <p>
              Each publisher is assigned a stake pool that typically includes
              the publisher’s self-stake and delegated stakes from other
              participants. The rewards distribution protocol programmatically
              shares rewards first to publishers, and then to stakers supporting
              them.
            </p>

            <p>
              You can sort publishers by their stake pool details, quality
              ranking, and more. Once you have chosen a publisher, click Stake
              and specify the number of tokens you wish to stake to their pool.
            </p>
          </>
        ),
        subTabs: [
          {
            title: "Selecting Publishers",
            description: (
              <>
                <p>
                  You can sort and evaluate publishers based on metrics such as
                  their stake pool composition, number of feeds supported,
                  quality ranking, and more.
                </p>

                <p>
                  These metrics can help you make informed decisions on which
                  pool to stake towards based on your goals for the oracle
                  network.
                </p>
              </>
            ),
            image: selectingPublishers,
          },
          {
            title: "Publisher Quality",
            description: (
              <>
                <p>
                  Oracle Integrity Staking incentivizes publishers to deliver
                  high-quality data, which is measured by a quality ranking
                  system. This ranking is based on three key factors: Uptime,
                  Price Deviation, and Price Staleness. Stakers can use these
                  rankings to help ensure the security of the price oracle.
                </p>
                <p>
                  Learn more about how quality rankings are calculated from the{" "}
                  <Link
                    href="https://docs.pyth.network/home/oracle-integrity-staking/publisher-quality-ranking"
                    target="_blank"
                    className="underline"
                  >
                    documentation
                  </Link>
                  .
                </p>
              </>
            ),
            image: publisherQuality,
          },
          {
            title: "Staking Rewards",
            description: (
              <>
                <p>
                  The total rewards generated by a stake pool depends on the
                  total number of tokens staked by the publisher and any
                  stakers.
                </p>
                <p>
                  As more tokens are staked to that pool, the stake pool’s total
                  potential rewards increases, up to a limit called the stake
                  cap. Publishers can raise their stake cap by supporting more
                  symbols (price feeds). Rewards are programmatically
                  distributed to publishers who provided high quality price data
                  that epoch. Any remaining rewards are distributed among the
                  stakers who supported these publishers. Publishers have
                  priority over rewards.
                </p>
                <p>
                  The Pyth DAO sets a <strong>maximum reward</strong> rate for
                  stake pools, currently set at 10%. This rate is achieved for a
                  pool when the total stake is below the stake cap. If the stake
                  cap is exceeded, the reward rate for stakers is reduced.
                </p>
                <p>
                  Publishers charge a fixed percentage (20%) of the rewards from
                  stakers in their stake pool as a delegation fee (net of any
                  slashed amount). The Pyth DAO can vote to adjust this fee
                  structure. Learn more about staking rewards in the
                  documentation.
                </p>
              </>
            ),
            image: stakingRewards,
          },
          {
            title: "Slashing",
            description: (
              <>
                <p>
                  Slashing helps ensures the integrity of Pyth Price Feeds by
                  penalizing publishers who provide inaccurate data. This
                  mechanism protects the oracle network but may affect your
                  stake if a publisher pool you delegate tokens towards is
                  penalized.
                </p>
                <p>
                  The current slashing rate is capped at 5% of publisher and
                  delegated stakes, and this rate can be adjusted by the Pyth
                  DAO. The slashed amounts are sent to the DAO wallet. The Pyth
                  DAO can choose to vote on future decisions for these slashed
                  amounts, such as opting to send them to parties affected by an
                  oracle misprint or using them in another way to support Pyth
                  Network.
                </p>
              </>
            ),
            image: slashing,
          },
        ],
        faq: {
          title: "Publisher Selection FAQ",
          questions: [
            {
              question: "What factors can increase a stake pool’s yield?",
              answer: (
                <>
                  <p>
                    A higher stake cap for a stake pool allows that publisher to
                    increase the pool’s notional rewards.
                  </p>
                  <p>
                    A publisher can increase their stake cap by supporting more
                    symbols. The pool’s notional rewards may be a factor to
                    consider when selecting a publisher to stake with. The
                    maximum reward rate functions as an absolute limit to any
                    publisher stake pool’s yield potential.
                  </p>
                  <p>
                    The Pyth DAO can vote to adjust these parameters. Learn more
                    about how rewards are calculated in the{" "}
                    <Link
                      href="https://docs.pyth.network/home/oracle-integrity-staking/mathematical-representation"
                      className="underline"
                      target="_blank"
                    >
                      documentation
                    </Link>
                    .
                  </p>
                </>
              ),
            },
            {
              question:
                "Can I still stake to pool whose total stake exceeds its stake cap?",
              answer: (
                <>
                  <p>
                    Yes, you can still stake tokens to a pool whose total stake
                    exceeds its stake cap. In this situation, the programmatic
                    reward rate for stakers mathematically decreases as the
                    amount of remaining rewards in the pool must be shared with
                    more delegated tokens. Learn more about how rewards are
                    calculated in the{" "}
                    <Link
                      href="https://docs.pyth.network/home/oracle-integrity-staking/mathematical-representation"
                      className="underline"
                      target="_blank"
                    >
                      documentation
                    </Link>
                    .
                  </p>
                </>
              ),
            },
            {
              question: "What do Estimated Next APY and Historical APY mean?",
              answer:
                "Estimated Next APY shows an estimated annualized reward rate for tokens staked to this stake pool based on the current stake pool composition plus the amount of tokens currently in warmup. Historical APY displays in a spark chart the past instantaneous annualized reward rates for that publisher for past epochs.",
            },
            {
              question: "What are delegation fees?",
              answer:
                "Delegation fees act as an incentive for publishers to publish data for more symbols (price feeds) to increase their stake cap. Publishers currently charge a fixed percentage of the rewards from stakers in their stake pool as a delegation fee (net of any slashed amount). The Pyth DAO can vote to adjust this fee structure.",
            },
            {
              question: "How are slashing events determined?",
              answer: (
                <>
                  <p>
                    Anyone can choose to raise a report for a plausible data
                    misprint. The Pythian Council of the Pyth DAO will then
                    review the reference data provided and compare against the
                    Pyth data to determine whether a slashing event should
                    occur. The council will have until the end of the epoch
                    after the epoch of the reported incident to review the
                    report. The tokens subject to slashing are the tokens
                    eligible for rewards{" "}
                    <i>during the epoch of the misprint incident</i>.
                  </p>
                  <p>
                    In the unlikely event that a published aggregate has been
                    found to be erroneous, a slashing event would then be
                    triggered. The stakes of the subset of publishers who
                    contributed to this incorrect aggregate are programmatically
                    slashed, along with the stakes of anyone who delegated
                    tokens towards them. Such slashing event occurs during the
                    epoch after the epoch of the reported incident.
                  </p>
                  <p>
                    The slashed amounts are sent to the Pyth DAO’s wallet. The
                    Pyth DAO can choose to vote on future decisions for these
                    slashed amounts, such as opting to send them to parties
                    affected by the oracle misprint or using them in another way
                    to support Pyth Network.
                  </p>
                </>
              ),
            },
            {
              question: "Does the slashing mechanism affect stakers?",
              answer:
                "It is important to note that both the Oracle Integrity Staking’s reward and slashing mechanisms affects both publishers and their supporting stakers. Publishers are accountable for the data they provide to the oracle, while stakers help strengthen the oracle by choosing which publishers to support.",
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
              Once you confirm your choice to stake to a publisher, your tokens
              will first enter a <strong>Warmup Period</strong>, which lasts
              until the end of the current epoch. An epoch is a one-week period
              starting every Thursday at 00:00 UTC.
            </p>

            <p>
              Tokens in the <strong>Warmup Period</strong> do not contribute to
              oracle security and are not eligible for sharing in publisher
              rewards or penalties. Once the <strong>Warmup Period</strong>{" "}
              ends, these tokens become staked and will play an active role in
              strengthening oracle integrity.
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
                  protocol by ensuring that total stakes for any pool remain
                  constant throughout the epoch.
                </p>
              </>
            ),
            image: warmupPeriods,
          },
          {
            title: "Epochs",
            description: (
              <p>
                Oracle Integrity Staking runs in epochs to ensure a safe and
                orderly process. Epochs are a fixed period of time lasting for
                one week and beginning every Thursday at 00:00 AM UTC. Warmup
                Periods last for one epoch at most.
              </p>
            ),
            image: epochs,
          },
          {
            title: "Staked Tokens",
            description: (
              <p>
                Tokens that complete the <strong>Warmup Period</strong> become
                officially staked. Staked tokens contribute to oracle integrity
                by enhancing potential publisher rewards and incentivizing high
                quality data contributions. Accordingly, staked tokens are
                subject to both programmatic rewards and slashing penalties.
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
                "Yes, all tokens you commit to staking will enter the same Warmup Period. For example, if you stake 1 PYTH token on Monday and another on Tuesday to the same publisher, both tokens will undergo the same Warmup Period and become officially staked on Thursday at 00:00 UTC.",
            },
            {
              question:
                "How frequently are rewards for each stake pool generated?",
              answer:
                "Rewards are programmatically generated for stake pools at the end of each epoch. You can claim your rewards for helping securing the oracle whenever they become available.",
            },
            {
              question: "Can I remove my tokens from the Warmup Period?",
              answer:
                "Yes, you can cancel tokens in the Warmup Period. Navigate to the publisher you have selected, and click Cancel under the Warmup window. You can choose how many tokens you wish to cancel from the staking process.",
            },
          ],
        },
      },
      {
        title: "Obtain Rewards",
        icon: ObtainRewards,
        description: (
          <>
            <p>
              Oracle Integrity Staking programmatically distributes rewards to
              publishers who contributed high quality data. The protocol then
              distributes the remaining rewards to the stakers who supported
              these publishers by delegating stake to them. Publishers have
              priority over rewards.
            </p>

            <p>
              Rewards for stakers are calculated at the end of each epoch and
              added to the <strong>Available Rewards</strong> balance. When you
              claim your rewards, the tokens move to{" "}
              <strong>Unlocked & Unstaked</strong>, where you can choose to
              restake or withdraw them to your wallet.
            </p>

            <p>
              If you decide to unstake your tokens from a publisher, they will
              enter a Cooldown Period before they can be restaked or withdrawn.
            </p>
          </>
        ),
        subTabs: [
          {
            title: "Claiming Rewards",
            description: (
              <>
                <p>
                  Rewards from helping secure the oracle will accumulate as
                  <strong>Available Rewards</strong> at the top of the
                  dashboard. Click <strong>Claim</strong> to move these rewards
                  to <strong>Unlocked & Unstaked</strong>.
                </p>
                <p>
                  Rewards must be claimed within one year of the epoch in which
                  they were generated. Claiming rewards from each pool
                  constitutes a separate transaction which incurs a very small
                  Solana transaction fee. You may have to click Claim multiple
                  times to fully claim the rewards.
                </p>
              </>
            ),
            image: claimingRewards,
          },
          {
            title: "Cooldown Periods",
            description: (
              <>
                <p>
                  The Cooldown Period for unstaking tokens lasts one full epoch
                  plus the remainder of the current epoch.
                </p>
                <p>
                  You can review these two phases under the Cooldown window for
                  the relevant publishers.
                </p>
                <p>
                  Please note that tokens in the first Cooldown phase are still
                  actively securing the oracle and subject to programmatic
                  rewards and slashing, while tokens in the second Cooldown
                  phase are not.
                </p>
              </>
            ),
            image: cooldownPeriods,
          },
        ],
        faq: {
          title: "Oracle Integrity Yield FAQ",
          questions: [
            {
              question: "What do the two phases of a Cooldown Period mean?",
              answer: (
                <>
                  <p>
                    When you commit to unstaking tokens from a publisher, those
                    tokens will first undergo a first phase of the Cooldown
                    Period from the time of clicking Unstake to the end of the
                    current epoch. These tokens still actively contribute to
                    oracle integrity and remain eligible to programmatic
                    rewards.
                  </p>
                  <p>
                    After this first phase, these tokens will undergo a second
                    phase in the Cooldown Period lasting one full epoch, during
                    which the tokens are no longer eligible to programmatic
                    rewards. These tokens are subject to slashing if a misprint
                    in the previous epoch is identified. Once this phase
                    concludes, your tokens will become unstaked and can be
                    restaked or withdrawn to your wallet.
                  </p>
                </>
              ),
            },
            {
              question: "Where do Oracle Integrity Staking rewards come from?",
              answer:
                "The yield for Oracle Integrity Staking currently comes from an allocation of 100M unlocked PYTH tokens by the Pyth Data Association. The Pyth DAO can vote to introduce new sources of yield in the future.",
            },
            {
              question:
                "What is the denomination of the Oracle Integrity Staking rewards?",
              answer:
                "The yield for Oracle Integrity Staking is currently denominated in PYTH tokens. The Pyth DAO can vote to include other digital assets in the reward set in the future.",
            },
          ],
        },
      },
    ]}
    {...props}
  />
);
