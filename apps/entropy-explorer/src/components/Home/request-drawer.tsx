import { Code } from "@phosphor-icons/react/dist/ssr/Code";
import { Question } from "@phosphor-icons/react/dist/ssr/Question";
import { Warning } from "@phosphor-icons/react/dist/ssr/Warning";
import { Button } from "@pythnetwork/component-library/Button";
import { CopyButton } from "@pythnetwork/component-library/CopyButton";
import { InfoBox } from "@pythnetwork/component-library/InfoBox";
import { Meter } from "@pythnetwork/component-library/Meter";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { Table } from "@pythnetwork/component-library/Table";
import { Term } from "@pythnetwork/component-library/Term";
import type { OpenDrawerArgs } from "@pythnetwork/component-library/useDrawer";
import type { ComponentProps } from "react";
import { useNumberFormatter } from "react-aria";
import TimeAgo from "react-timeago";

import styles from "./request-drawer.module.scss";
import { getErrorDetails } from "../../errors";
import type {
  Request,
  CallbackErrorRequest,
  FailedRequest,
} from "../../requests";
import { Status } from "../../requests";
import { truncate } from "../../truncate";
import { Account, Transaction } from "../Address";
import { Status as StatusComponent } from "../Status";
import { Timestamp } from "../Timestamp";
import { ChainTag } from "./chain-tag";

export const mkRequestDrawer = (
  request: Request,
  now: Date,
): OpenDrawerArgs => ({
  title: `Request ${truncate(request.requestTxHash)}`,
  headingExtra: <StatusComponent status={request.status} />,
  bodyClassName: styles.requestDrawer ?? "",
  fill: true,
  contents: <RequestDrawerBody request={request} now={now} />,
});

const RequestDrawerBody = ({
  request,
  now,
}: {
  request: Request;
  now: Date;
}) => {
  const gasFormatter = useNumberFormatter({ maximumFractionDigits: 3 });

  return (
    <>
      <div className={styles.cards}>
        <StatCard
          nonInteractive
          header="Random Number"
          small
          variant="primary"
          stat={
            "randomNumber" in request ? (
              <CopyButton text={request.randomNumber}>
                <code>{truncate(request.randomNumber)}</code>
              </CopyButton>
            ) : (
              <StatusComponent status={request.status} />
            )
          }
        />
        <StatCard
          nonInteractive
          header="Sequence Number"
          small
          stat={request.sequenceNumber}
        />
      </div>
      {request.status === Status.CallbackError && (
        <CallbackErrorInfo request={request} />
      )}
      {request.status === Status.Failed && (
        <FailureInfo header="Reveal failed!" request={request} />
      )}
      <Table
        label="Details"
        fill
        className={styles.details ?? ""}
        columns={[
          {
            id: "field",
            name: "Field",
            alignment: "left",
            isRowHeader: true,
            sticky: true,
          },
          {
            id: "value",
            name: "Value",
            fill: true,
            alignment: "left",
          },
        ]}
        rows={[
          {
            id: "chain",
            field: "Chain",
            value: <ChainTag chain={request.chain} />,
          },
          {
            id: "requestTimestamp",
            field: "Request Timestamp",
            value: <Timestamp timestamp={request.requestTimestamp} now={now} />,
          },
          ...("callbackTimestamp" in request
            ? [
                {
                  id: "callbackTimestamp",
                  field: "Callback Timestamp",
                  value: (
                    <Timestamp
                      timestamp={request.callbackTimestamp}
                      now={now}
                    />
                  ),
                },
                {
                  id: "duration",
                  field: (
                    <Term term="Duration">
                      The amount of time between the request transaction and the
                      callback transaction.
                    </Term>
                  ),
                  value: (
                    <TimeAgo
                      now={() => request.callbackTimestamp.getTime()}
                      date={request.requestTimestamp}
                      live={false}
                      formatter={(value, unit) =>
                        `${value.toString()} ${unit}${value === 1 ? "" : "s"}`
                      }
                    />
                  ),
                },
              ]
            : []),
          {
            id: "requestTx",
            field: (
              <Term term="Request Transaction">
                The transaction that requests a new random number from the
                Entropy protocol.
              </Term>
            ),
            value: (
              <Transaction
                chain={request.chain}
                value={request.requestTxHash}
              />
            ),
          },
          {
            id: "sender",
            field: "Sender",
            value: <Account chain={request.chain} value={request.sender} />,
          },
          ...(request.status === Status.Complete
            ? [
                {
                  id: "callbackTx",
                  field: (
                    <Term term="Callback Transaction">
                      Entropy’s response transaction that returns the random
                      number to the requester.
                    </Term>
                  ),
                  value: (
                    <Transaction
                      chain={request.chain}
                      value={request.callbackTxHash}
                    />
                  ),
                },
              ]
            : []),
          {
            id: "provider",
            field: "Provider",
            value: <Account chain={request.chain} value={request.provider} />,
          },
          {
            id: "userContribution",
            field: (
              <Term term="User Contribution">
                User-submitted randomness included in the request.
              </Term>
            ),
            value: (
              <CopyButton text={request.userContribution}>
                <code>{truncate(request.userContribution)}</code>
              </CopyButton>
            ),
          },
          ...("providerContribution" in request
            ? [
                {
                  id: "providerContribution",
                  field: (
                    <Term term="Provider Contribution">
                      Provider-submitted randomness used to calculate the random
                      number.
                    </Term>
                  ),
                  value: (
                    <CopyButton text={request.providerContribution}>
                      <code>{truncate(request.providerContribution)}</code>
                    </CopyButton>
                  ),
                },
              ]
            : []),
          {
            id: "gas",
            field: "Gas",
            value:
              "gasUsed" in request ? (
                <Meter
                  label="Gas"
                  value={request.gasUsed}
                  maxValue={request.gasLimit}
                  className={styles.gasMeter ?? ""}
                  startLabel={`${gasFormatter.format(request.gasUsed)} used`}
                  endLabel={`${gasFormatter.format(request.gasLimit)} max`}
                  labelClassName={styles.gasMeterLabel ?? ""}
                  variant={
                    request.gasUsed > request.gasLimit ? "error" : "default"
                  }
                />
              ) : (
                `${gasFormatter.format(request.gasLimit)} max`
              ),
          },
        ].map((data) => ({
          id: data.id,
          data: {
            field: <span className={styles.field}>{data.field}</span>,
            value: data.value,
          },
        }))}
      />
    </>
  );
};

const CallbackErrorInfo = ({ request }: { request: CallbackErrorRequest }) => {
  const retryCommand = `cast send ${request.chain.address} 'revealWithCallback(address, uint64, bytes32, bytes32)' ${request.provider} ${request.sequenceNumber.toString()} ${request.userContribution} ${request.providerContribution} -r ${request.chain.rpc} --private-key <YOUR_PRIVATE_KEY>`;

  return (
    <>
      <FailureInfo header="Callback failed!" request={request} />
      <InfoBox
        header="Retry the callback yourself"
        icon={<Code />}
        className={styles.message}
        variant="info"
      >
        {`If you'd like to execute your callback, you can run the command in your
        terminal or connect your wallet to run it here.`}
        <div
          style={{
            display: "flex",
            flexFlow: "row nowrap",
            justifyContent: "end",
            gap: "16px",
            marginTop: "16px",
          }}
        >
          <CopyButton text={retryCommand}>Copy Cast Command</CopyButton>
          <Button
            size="sm"
            variant="ghost"
            beforeIcon={<Question />}
            rounded
            hideText
            href="https://docs.pyth.network/entropy/debug-callback-failures"
            target="_blank"
            className={styles.helpButton ?? ""}
          >
            Help
          </Button>
        </div>
      </InfoBox>
    </>
  );
};

const FailureInfo = ({
  request,
  ...props
}: ComponentProps<typeof InfoBox> & {
  request: CallbackErrorRequest | FailedRequest;
}) => (
  <InfoBox
    icon={<Warning />}
    className={styles.message}
    variant="warning"
    {...props}
  >
    <Button
      hideText
      beforeIcon={<Question />}
      rounded
      size="sm"
      variant="ghost"
      className={styles.helpButton ?? ""}
      href={getHelpLink(request)}
      target="_blank"
    >
      Help
    </Button>
    <div className={styles.failureMessage}>
      <FailureMessage request={request} />
    </div>
  </InfoBox>
);

const getHelpLink = (request: CallbackErrorRequest | FailedRequest) => {
  const details = getErrorDetails(request.reason);
  if (details === undefined) {
    return isGasLimitExceeded(request)
      ? "https://docs.pyth.network/entropy/best-practices#limit-gas-usage-on-the-callback"
      : "https://docs.pyth.network/entropy/best-practices#handling-callback-failures";
  } else {
    return details[2];
  }
};

const FailureMessage = ({
  request,
}: {
  request: CallbackErrorRequest | FailedRequest;
}) => {
  const details = getErrorDetails(request.reason);
  if (details) {
    return (
      <>
        <p>The callback encountered the following error:</p>
        <p className={styles.details}>
          <b>{details[0]}</b> (<code>{request.reason}</code>): {details[1]}
        </p>
      </>
    );
  } else if (isGasLimitExceeded(request)) {
    return "The callback used more gas than the set gas limit";
  } else {
    return (
      <>
        <b>Error response:</b> {request.reason}
      </>
    );
  }
};

const isGasLimitExceeded = (request: CallbackErrorRequest | FailedRequest) =>
  request.status === Status.CallbackError &&
  request.reason === "0x" &&
  request.gasUsed > request.gasLimit;
