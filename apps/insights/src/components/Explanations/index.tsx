import { Button } from "@pythnetwork/component-library/Button";
import { useMemo } from "react";

import { Explain } from "../Explain";
import { FormattedDate } from "../FormattedDate";

export const ExplainRanking = ({
  scoreTime,
}: {
  scoreTime?: Date | undefined;
}) => {
  return (
    <Explain size="xs" title="Permissioned Feeds">
      <p>
        The publisher{"'"}s <b>ranking</b> is determined by the number of{" "}
        <b>Price Feeds</b> that publisher has permissions to publish to.
      </p>
      {scoreTime && <EvaluationTime scoreTime={scoreTime} />}
    </Explain>
  );
};

export const ExplainPermissioned = ({
  scoreTime,
}: {
  scoreTime?: Date | undefined;
}) => (
  <Explain size="xs" title="Permissioned Feeds">
    <p>
      This is the number of <b>Price Feeds</b> that a <b>Publisher</b> has
      permissions to publish to. The publisher is not necessarily pushing data
      for all the feeds they have access to, and some feeds may not be live yet.
    </p>
    {scoreTime && <EvaluationTime scoreTime={scoreTime} />}
  </Explain>
);

export const ExplainUnpermissioned = () => (
  <Explain size="xs" title="Unpermissioned Feeds">
    <p>
      This is the number of <b>Price Feeds</b> that a <b>Publisher</b> does not
      have permissions to publish to.
    </p>
  </Explain>
);

export const ExplainAverage = ({
  scoreTime,
}: {
  scoreTime?: Date | undefined;
}) => {
  return (
    <Explain size="xs" title="Average Feed Score">
      <p>
        Each <b>Price Feed Component</b> that a <b>Publisher</b> provides has an
        associated <b>Score</b>, which is determined by that component{"'"}s{" "}
        <b>Uptime</b>, <b>Price Deviation</b>, and <b>Staleness</b>. The{" "}
        <b>Average Feed Score</b> is the average of the scores for all{" "}
        <b>Price Feed Components</b>.
      </p>
      {scoreTime && <EvaluationTime scoreTime={scoreTime} />}
      <Button
        size="xs"
        variant="solid"
        href="https://docs.pyth.network/home/oracle-integrity-staking/publisher-quality-ranking"
        target="_blank"
      >
        Learn more
      </Button>
    </Explain>
  );
};

export const EvaluationTime = ({ scoreTime }: { scoreTime: Date }) => {
  const startTime = useMemo(() => {
    const date = new Date(scoreTime);
    date.setDate(date.getDate() - 1);
    return date;
  }, [scoreTime]);

  return (
    <p>
      This value is calculated based on feed performance from{" "}
      <b>
        <FormattedDate
          value={startTime}
          dateStyle="long"
          timeStyle="long"
          timeZone="utc"
        />
      </b>{" "}
      to{" "}
      <b>
        <FormattedDate
          value={scoreTime}
          dateStyle="long"
          timeStyle="long"
          timeZone="utc"
        />
      </b>
      .
    </p>
  );
};
