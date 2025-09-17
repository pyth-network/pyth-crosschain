"use client";

import { Card } from "@pythnetwork/component-library/Card";
import { Label } from "@pythnetwork/component-library/unstyled/Label";
import { Input } from "@pythnetwork/component-library/unstyled/TextField";
import { clsx } from "clsx";
import { useState, useEffect } from "react";

import styles from "./index.module.scss";

// Components for mathematical notation
const MathExpression = ({ children }: { children: React.ReactNode }) => (
  <span className={clsx(styles.mathExpression)}>{children}</span>
);

// Component for subscripts and superscripts
const Sub = ({ children }: { children: React.ReactNode }) => (
  <sub>{children}</sub>
);

const Sup = ({ children }: { children: React.ReactNode }) => (
  <sup>{children}</sup>
);

const RewardSimulator: React.FC = () => {
  const [publisherStake, setPublisherStake] = useState(200);
  const [delegatorStake, setDelegatorStake] = useState(300);
  const [maxCap, setMaxCap] = useState(500);
  const [delegatorFee, setDelegatorFee] = useState(20);
  const [rewardRate, setRewardRate] = useState(10);

  const [publisherReward, setPublisherReward] = useState(0);
  const [delegatorReward, setDelegatorReward] = useState(0);
  const [publisherRewardRate, setPublisherRewardRate] = useState(0);
  const [delegatorRewardRate, setDelegatorRewardRate] = useState(0);

  useEffect(() => {
    const calculateRewards = () => {
      const totalStake = publisherStake + delegatorStake;
      const eligibleAmount = Math.min(totalStake, maxCap);
      const totalReward = (rewardRate / 100) * eligibleAmount;

      const publisherRewardBase =
        (rewardRate / 100) * Math.min(publisherStake, maxCap);
      const delegatorRewardBase = totalReward - publisherRewardBase;

      const delegatorFeeAmount = (delegatorFee / 100) * delegatorRewardBase;

      const finalDelegatorReward = delegatorRewardBase - delegatorFeeAmount;
      const finalPublisherReward = publisherRewardBase + delegatorFeeAmount;

      setPublisherReward(Number(finalPublisherReward.toFixed(2)));
      setDelegatorReward(Number(finalDelegatorReward.toFixed(2)));
      setPublisherRewardRate(
        Number(((finalPublisherReward * 100) / publisherStake).toFixed(2)),
      );
      setDelegatorRewardRate(
        Number(((finalDelegatorReward * 100) / delegatorStake).toFixed(2)),
      );
    };

    calculateRewards();
  }, [publisherStake, delegatorStake, maxCap, delegatorFee, rewardRate]);

  return (
    <Card
      variant="secondary"
      title="Reward Simulator"
      nonInteractive
      className={clsx(styles.card)}
    >
      <div className={clsx(styles.inputGrid)}>
        <div className={clsx(styles.inputGroup)}>
          <Label htmlFor="publisher-stake">
            Publisher Stake (
            <MathExpression>
              S<Sub>p</Sub>
              <Sup>p</Sup>
            </MathExpression>
            ):
          </Label>
          <Input
            id="publisher-stake"
            type="number"
            value={publisherStake}
            onChange={(e) => {
              setPublisherStake(Number(e.target.value));
            }}
            className={clsx(styles.input)}
            min="0"
          />
        </div>

        <div className={clsx(styles.inputGroup)}>
          <Label htmlFor="delegator-stake">
            Delegator Stake (
            <MathExpression>
              S<Sub>p</Sub>
              <Sup>d</Sup>
            </MathExpression>
            ):
          </Label>
          <Input
            id="delegator-stake"
            type="number"
            value={delegatorStake}
            onChange={(e) => {
              setDelegatorStake(Number(e.target.value));
            }}
            className={clsx(styles.input)}
            min="0"
          />
        </div>

        <div className={clsx(styles.inputGroup)}>
          <Label htmlFor="max-cap">
            Maximum Cap (
            <MathExpression>
              C<Sub>p</Sub>
            </MathExpression>
            ):
          </Label>
          <Input
            id="max-cap"
            type="number"
            value={maxCap}
            onChange={(e) => {
              setMaxCap(Number(e.target.value));
            }}
            className={clsx(styles.input)}
            min="0"
          />
        </div>

        <div className={clsx(styles.inputGroup)}>
          <Label htmlFor="delegator-fee">
            Delegator Fee (<MathExpression>f</MathExpression>) (%):
          </Label>
          <Input
            id="delegator-fee"
            type="number"
            value={delegatorFee}
            onChange={(e) => {
              setDelegatorFee(Number(e.target.value));
            }}
            className={clsx(styles.input)}
            min="0"
            max="100"
            step="0.1"
          />
        </div>

        <div className={clsx(styles.inputGroup)}>
          <Label htmlFor="reward-rate">
            Reward Rate (<MathExpression>r</MathExpression>) (%):
          </Label>
          <Input
            id="reward-rate"
            type="number"
            value={rewardRate}
            onChange={(e) => {
              setRewardRate(Number(e.target.value));
            }}
            className={clsx(styles.input)}
            min="0"
            max="100"
            step="0.1"
          />
        </div>
      </div>

      <div className={clsx(styles.resultsSection)}>
        <div className={clsx(styles.resultsGrid)}>
          <div className={clsx(styles.resultGroup)}>
            <h4 className={clsx(styles.resultTitle)}>Calculated Rewards</h4>
            <div className={clsx(styles.resultValues)}>
              <p className={clsx(styles.resultItem)}>
                <span className={clsx(styles.resultLabel)}>
                  Publisher Reward (
                  <MathExpression>
                    R<Sup>p</Sup>
                    <Sub>p</Sub>
                  </MathExpression>
                  ):
                </span>{" "}
                <span className={clsx(styles.resultValue)}>
                  {publisherReward}
                </span>
              </p>
              <p className={clsx(styles.resultItem)}>
                <span className={clsx(styles.resultLabel)}>
                  Delegator Reward (
                  <MathExpression>
                    R<Sup>d</Sup>
                    <Sub>p</Sub>
                  </MathExpression>
                  ):
                </span>{" "}
                <span className={clsx(styles.resultValue)}>
                  {delegatorReward}
                </span>
              </p>
            </div>
          </div>

          <div className={clsx(styles.resultGroup)}>
            <h4 className={clsx(styles.resultTitle)}>
              Calculated Reward Rates (Yearly)
            </h4>
            <div className={clsx(styles.resultValues)}>
              <p className={clsx(styles.resultItem)}>
                <span className={clsx(styles.resultLabel)}>
                  Publisher Rate (
                  <MathExpression>
                    r<Sup>p</Sup>
                    <Sub>p</Sub>
                  </MathExpression>
                  ):
                </span>{" "}
                <span className={clsx(styles.resultValue)}>
                  {publisherRewardRate}%
                </span>
              </p>
              <p className={clsx(styles.resultItem)}>
                <span className={clsx(styles.resultLabel)}>
                  Delegator Rate (
                  <MathExpression>
                    r<Sup>d</Sup>
                    <Sub>p</Sub>
                  </MathExpression>
                  ):
                </span>{" "}
                <span className={clsx(styles.resultValue)}>
                  {delegatorRewardRate}%
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RewardSimulator;
