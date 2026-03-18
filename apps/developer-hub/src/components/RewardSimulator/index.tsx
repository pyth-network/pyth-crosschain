"use client";

import { Card } from "@pythnetwork/component-library/Card";
import { Label } from "@pythnetwork/component-library/unstyled/Label";
import { Input } from "@pythnetwork/component-library/unstyled/TextField";
import { useCallback, useState } from "react";

import styles from "./index.module.scss";

// Components for mathematical notation
const MathExpression = ({ children }: { children: React.ReactNode }) => (
  <span className={styles.mathExpression}>{children}</span>
);

// Component for subscripts and superscripts
const Sub = ({ children }: { children: React.ReactNode }) => (
  <sub>{children}</sub>
);

const Sup = ({ children }: { children: React.ReactNode }) => (
  <sup>{children}</sup>
);

const RewardSimulator: React.FC = () => {
  const [rewards, setRewards] = useState({
    delegator: 24,
    delegatorRate: 8,
    // These are the initial values for the reward simulator based on default values
    publisher: 26,
    publisherRate: 13,
  });

  const doSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.currentTarget.requestSubmit();
  }, []);

  const recalculateRewards = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);

      const publisherStake = Number(formData.get("publisherStake")) || 0;
      const delegatorStake = Number(formData.get("delegatorStake")) || 0;
      const maxCap = Number(formData.get("maxCap")) || 0;
      const delegatorFee = Number(formData.get("delegatorFee")) || 0;
      const rewardRate = Number(formData.get("rewardRate")) || 0;

      const totalStake = publisherStake + delegatorStake;
      const eligibleAmount = Math.min(totalStake, maxCap);
      const totalReward = (rewardRate / 100) * eligibleAmount;

      const publisherRewardBase =
        (rewardRate / 100) * Math.min(publisherStake, maxCap);
      const delegatorRewardBase = totalReward - publisherRewardBase;

      const delegatorFeeAmount = (delegatorFee / 100) * delegatorRewardBase;

      const finalDelegatorReward = delegatorRewardBase - delegatorFeeAmount;
      const finalPublisherReward = publisherRewardBase + delegatorFeeAmount;

      setRewards({
        delegator: Number(finalDelegatorReward.toFixed(2)),
        delegatorRate: Number(
          ((finalDelegatorReward * 100) / delegatorStake).toFixed(2),
        ),
        publisher: Number(finalPublisherReward.toFixed(2)),
        publisherRate: Number(
          ((finalPublisherReward * 100) / publisherStake).toFixed(2),
        ),
      });
    },
    [],
  );

  return (
    <Card
      className={styles.card}
      nonInteractive
      title="Reward Simulator"
      variant="secondary"
    >
      <form onChange={doSubmit} onSubmit={recalculateRewards}>
        <div className={styles.inputGrid}>
          <div className={styles.inputGroup}>
            <Label htmlFor="publisher-stake">
              Publisher Stake (
              <MathExpression>
                S<Sub>p</Sub>
                <Sup>p</Sup>
              </MathExpression>
              ):
            </Label>
            <Input
              className={styles.input ?? ""}
              defaultValue={200}
              id="publisher-stake"
              min="0"
              name="publisherStake"
              type="number"
            />
          </div>

          <div className={styles.inputGroup}>
            <Label htmlFor="delegator-stake">
              Delegator Stake (
              <MathExpression>
                S<Sub>p</Sub>
                <Sup>d</Sup>
              </MathExpression>
              ):
            </Label>
            <Input
              className={styles.input ?? ""}
              defaultValue={300}
              id="delegator-stake"
              min="0"
              name="delegatorStake"
              type="number"
            />
          </div>

          <div className={styles.inputGroup}>
            <Label htmlFor="max-cap">
              Maximum Cap (
              <MathExpression>
                C<Sub>p</Sub>
              </MathExpression>
              ):
            </Label>
            <Input
              className={styles.input ?? ""}
              defaultValue={500}
              id="max-cap"
              min="0"
              name="maxCap"
              type="number"
            />
          </div>

          <div className={styles.inputGroup}>
            <Label htmlFor="delegator-fee">
              Delegator Fee (<MathExpression>f</MathExpression>) (%):
            </Label>
            <Input
              className={styles.input ?? ""}
              defaultValue={20}
              id="delegator-fee"
              max="100"
              min="0"
              name="delegatorFee"
              step="0.1"
              type="number"
            />
          </div>

          <div className={styles.inputGroup}>
            <Label htmlFor="reward-rate">
              Reward Rate (<MathExpression>r</MathExpression>) (%):
            </Label>
            <Input
              className={styles.input ?? ""}
              defaultValue={10}
              id="reward-rate"
              max="100"
              min="0"
              name="rewardRate"
              step="0.1"
              type="number"
            />
          </div>
        </div>

        <div className={styles.resultsSection}>
          <div className={styles.resultsGrid}>
            <div className={styles.resultGroup}>
              <h4 className={styles.resultTitle}>Calculated Rewards</h4>
              <dl className={styles.resultList}>
                <dt className={styles.resultTerm}>
                  Publisher Reward (
                  <MathExpression>
                    R<Sup>p</Sup>
                    <Sub>p</Sub>
                  </MathExpression>
                  ):
                </dt>
                <dd className={styles.resultValue}>{rewards.publisher}</dd>
                <dt className={styles.resultTerm}>
                  Delegator Reward (
                  <MathExpression>
                    R<Sup>d</Sup>
                    <Sub>p</Sub>
                  </MathExpression>
                  ):
                </dt>
                <dd className={styles.resultValue}>{rewards.delegator}</dd>
              </dl>
            </div>

            <div className={styles.resultGroup}>
              <h4 className={styles.resultTitle}>
                Calculated Reward Rates (Yearly)
              </h4>
              <dl className={styles.resultList}>
                <dt className={styles.resultTerm}>
                  Publisher Rate (
                  <MathExpression>
                    r<Sup>p</Sup>
                    <Sub>p</Sub>
                  </MathExpression>
                  ):
                </dt>
                <dd className={styles.resultValue}>{rewards.publisherRate}%</dd>
                <dt className={styles.resultTerm}>
                  Delegator Rate (
                  <MathExpression>
                    r<Sup>d</Sup>
                    <Sub>p</Sub>
                  </MathExpression>
                  ):
                </dt>
                <dd className={styles.resultValue}>{rewards.delegatorRate}%</dd>
              </dl>
            </div>
          </div>
        </div>
      </form>
    </Card>
  );
};

export default RewardSimulator;
