"use client";

import { Card } from "@pythnetwork/component-library/Card";
import { Label } from "@pythnetwork/component-library/unstyled/Label";
import { Input } from "@pythnetwork/component-library/unstyled/TextField";
import { useState, useCallback } from "react";

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
  // Per OP-PIP-103, reward rate y is now 0 — all rewards are 0
  const [rewards, setRewards] = useState({
    publisher: 0,
    delegator: 0,
    publisherRate: 0,
    delegatorRate: 0,
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
        publisher: Number(finalPublisherReward.toFixed(2)),
        delegator: Number(finalDelegatorReward.toFixed(2)),
        publisherRate: publisherStake > 0 ? Number(
          ((finalPublisherReward * 100) / publisherStake).toFixed(2),
        ) : 0,
        delegatorRate: delegatorStake > 0 ? Number(
          ((finalDelegatorReward * 100) / delegatorStake).toFixed(2),
        ) : 0,
      });
    },
    [],
  );

  return (
    <Card
      variant="secondary"
      title="Reward Simulator"
      nonInteractive
      className={styles.card}
    >
      <p className={styles.notice}>
        <strong>Note:</strong> Per OP-PIP-103, the reward rate (y) is currently 0. This simulator shows historical mechanics.
      </p>
      <form onSubmit={recalculateRewards} onChange={doSubmit}>
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
              id="publisher-stake"
              name="publisherStake"
              type="number"
              defaultValue={200}
              className={styles.input ?? ""}
              min="0"
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
              id="delegator-stake"
              name="delegatorStake"
              type="number"
              defaultValue={300}
              className={styles.input ?? ""}
              min="0"
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
              id="max-cap"
              name="maxCap"
              type="number"
              defaultValue={500}
              className={styles.input ?? ""}
              min="0"
            />
          </div>

          <div className={styles.inputGroup}>
            <Label htmlFor="delegator-fee">
              Delegator Fee (<MathExpression>f</MathExpression>) (%):
            </Label>
            <Input
              id="delegator-fee"
              name="delegatorFee"
              type="number"
              defaultValue={20}
              className={styles.input ?? ""}
              min="0"
              max="100"
              step="0.1"
            />
          </div>

          <div className={styles.inputGroup}>
            <Label htmlFor="reward-rate">
              Reward Rate (<MathExpression>y</MathExpression>) (%):
            </Label>
            <Input
              id="reward-rate"
              name="rewardRate"
              type="number"
              defaultValue={0}
              className={styles.input ?? ""}
              min="0"
              max="100"
              step="0.1"
              disabled
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
