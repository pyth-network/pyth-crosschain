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
import { getErrorDetails } from "../../errors";
import type {
  CallbackErrorRequest,
  FailedRequest,
  Request,
} from "../../requests";
import { Status } from "../../requests";
import { truncate } from "../../truncate";
import { Account, Transaction } from "../Address";
import { Status as StatusComponent } from "../Status";
import { Timestamp } from "../Timestamp";
import { ChainTag } from "./chain-tag";
import styles from "./request-drawer.module.scss";

export const mkRequestDrawer = (
  request: Request,
  now: Date,
): OpenDrawerArgs => ({
  bodyClassName: styles.requestDrawer ?? "",
  contents: <RequestDrawerBody now={now} request={request} />,
  fill: true,
  headingExtra: <StatusComponent status={request.status} />,
  title: `Request ${truncate(request.requestTxHash)}`,
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
          header="Random Number"
          nonInteractive
          small
          stat={
            "randomNumber" in request ? (
              <CopyButton text={request.randomNumber}>
                <code>{truncate(request.randomNumber)}</code>
              </CopyButton>
            ) : (
              <StatusComponent status={request.status} />
            )
          }
          variant="primary"
        />
        <StatCard
          header="Sequence Number"
          nonInteractive
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
        className={styles.details ?? ""}
        columns={[
          {
            alignment: "left",
            id: "field",
            isRowHeader: true,
            name: "Field",
            sticky: true,
          },
          {
            alignment: "left",
            fill: true,
            id: "value",
            name: "Value",
          },
        ]}
        fill
        label="Details"
        rows={[
          {
            field: "Chain",
            id: "chain",
            value: <ChainTag chain={request.chain} />,
          },
          {
            field: "Request Timestamp",
            id: "requestTimestamp",
            value: <Timestamp now={now} timestamp={request.requestTimestamp} />,
          },
          ...("callbackTimestamp" in request
            ? [
                {
                  field: "Callback Timestamp",
                  id: "callbackTimestamp",
                  value: (
                    <Timestamp
                      now={now}
                      timestamp={request.callbackTimestamp}
                    />
                  ),
                },
                {
                  field: (
                    <Term term="Duration">
                      The amount of time between the request transaction and the
                      callback transaction.
                    </Term>
                  ),
                  id: "duration",
                  value: (
                    <TimeAgo
                      date={request.requestTimestamp}
                      formatter={(value, unit) =>
                        `${value.toString()} ${unit}${value === 1 ? "" : "s"}`
                      }
                      live={false}
                      now={() => request.callbackTimestamp.getTime()}
                    />
                  ),
                },
              ]
            : []),
          {
            field: (
              <Term term="Request Transaction">
                The transaction that requests a new random number from the
                Entropy protocol.
              </Term>
            ),
            id: "requestTx",
            value: (
              <Transaction
                chain={request.chain}
                value={request.requestTxHash}
              />
            ),
          },
          {
            field: "Sender",
            id: "sender",
            value: <Account chain={request.chain} value={request.sender} />,
          },
          ...(request.status === Status.Complete
            ? [
                {
                  field: (
                    <Term term="Callback Transaction">
                      Entropy’s response transaction that returns the random
                      number to the requester.
                    </Term>
                  ),
                  id: "callbackTx",
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
            field: "Provider",
            id: "provider",
            value: <Account chain={request.chain} value={request.provider} />,
          },
          {
            field: (
              <Term term="User Contribution">
                User-submitted randomness included in the request.
              </Term>
            ),
            id: "userContribution",
            value: (
              <CopyButton text={request.userContribution}>
                <code>{truncate(request.userContribution)}</code>
              </CopyButton>
            ),
          },
          ...("providerContribution" in request
            ? [
                {
                  field: (
                    <Term term="Provider Contribution">
                      Provider-submitted randomness used to calculate the random
                      number.
                    </Term>
                  ),
                  id: "providerContribution",
                  value: (
                    <CopyButton text={request.providerContribution}>
                      <code>{truncate(request.providerContribution)}</code>
                    </CopyButton>
                  ),
                },
              ]
            : []),
          {
            field: "Gas",
            id: "gas",
            value:
              "gasUsed" in request ? (
                <Meter
                  className={styles.gasMeter ?? ""}
                  endLabel={`${gasFormatter.format(request.gasLimit)} max`}
                  label="Gas"
                  labelClassName={styles.gasMeterLabel ?? ""}
                  maxValue={request.gasLimit}
                  startLabel={`${gasFormatter.format(request.gasUsed)} used`}
                  value={request.gasUsed}
                  variant={
                    request.gasUsed > request.gasLimit ? "error" : "default"
                  }
                />
              ) : (
                `${gasFormatter.format(request.gasLimit)} max`
              ),
          },
        ].map((data) => ({
          data: {
            field: <span className={styles.field}>{data.field}</span>,
            value: data.value,
          },
          id: data.id,
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
        className={styles.message}
        header="Retry the callback yourself"
        icon={<Code />}
        variant="info"
      >
        {`If you'd like to execute your callback, you can run the command in your
        terminal or connect your wallet to run it here.`}
        <div
          style={{
            display: "flex",
            flexFlow: "row nowrap",
            gap: "16px",
            justifyContent: "end",
            marginTop: "16px",
          }}
        >
          <CopyButton text={retryCommand}>Copy Cast Command</CopyButton>
          <Button
            beforeIcon={<Question />}
            className={styles.helpButton ?? ""}
            hideText
            href="https://docs.pyth.network/entropy/debug-callback-failures"
            rounded
            size="sm"
            target="_blank"
            variant="ghost"
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
    className={styles.message}
    icon={<Warning />}
    variant="warning"
    {...props}
  >
    <Button
      beforeIcon={<Question />}
      className={styles.helpButton ?? ""}
      hideText
      href={getHelpLink(request)}
      rounded
      size="sm"
      target="_blank"
      variant="ghost"
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
