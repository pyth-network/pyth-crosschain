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
import { useNumberFormatter } from "react-aria";
import TimeAgo from "react-timeago";

import styles from "./request-drawer.module.scss";
import { EntropyDeployments } from "../../entropy-deployments";
import { getErrorDetails } from "../../errors";
import type { Request, CallbackErrorRequest } from "../../requests";
import { Status } from "../../requests";
import { truncate } from "../../truncate";
import { Address } from "../Address";
import { Status as StatusComponent } from "../Status";
import { Timestamp } from "../Timestamp";

export const mkRequestDrawer = (request: Request): OpenDrawerArgs => ({
  title: `Request ${truncate(request.requestTxHash)}`,
  headingExtra: <StatusComponent prefix="CALLBACK " status={request.status} />,
  bodyClassName: styles.requestDrawer ?? "",
  fill: true,
  contents: <RequestDrawerBody request={request} />,
});

const RequestDrawerBody = ({ request }: { request: Request }) => {
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
            request.status === Status.Pending ? (
              <StatusComponent prefix="CALLBACK " status={Status.Pending} />
            ) : (
              <CopyButton text={request.randomNumber}>
                <code>{truncate(request.randomNumber)}</code>
              </CopyButton>
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
        <CallbackFailedInfo request={request} />
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
            id: "requestTimestamp",
            field: "Request Timestamp",
            value: <Timestamp timestamp={request.requestTimestamp} />,
          },
          ...(request.status === Status.Pending
            ? []
            : [
                {
                  id: "callbackTimestamp",
                  field: "Callback Timestamp",
                  value: <Timestamp timestamp={request.callbackTimestamp} />,
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
              ]),
          {
            id: "requestTx",
            field: (
              <Term term="Request Transaction">
                The transaction that requests a new random number from the
                Entropy protocol.
              </Term>
            ),
            value: (
              <Address chain={request.chain} value={request.requestTxHash} />
            ),
          },
          {
            id: "sender",
            field: "Sender",
            value: <Address chain={request.chain} value={request.sender} />,
          },
          ...(request.status === Status.Pending
            ? []
            : [
                {
                  id: "callbackTx",
                  field: (
                    <Term term="Callback Transaction">
                      Entropy’s response transaction that returns the random
                      number to the requester.
                    </Term>
                  ),
                  value: (
                    <Address
                      chain={request.chain}
                      value={request.callbackTxHash}
                    />
                  ),
                },
              ]),
          {
            id: "provider",
            field: "Provider",
            value: <Address chain={request.chain} value={request.provider} />,
          },
          {
            id: "userContribution",
            field: (
              <Term term="User Contribution">
                User-submitted randomness included in the request.
              </Term>
            ),
            value: (
              <CopyButton text={request.userRandomNumber}>
                <code>{truncate(request.userRandomNumber)}</code>
              </CopyButton>
            ),
          },
          {
            id: "providerContribution",
            field: (
              <Term term="Provider Contribution">
                Provider-submitted randomness used to calculate the random
                number.
              </Term>
            ),
            value: (
              <CopyButton text={request.userRandomNumber}>
                <code>{truncate(request.userRandomNumber)}</code>
              </CopyButton>
            ),
          },
          {
            id: "gas",
            field: "Gas",
            value:
              request.status === Status.Pending ? (
                `${gasFormatter.format(request.gasLimit)} max`
              ) : (
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

const CallbackFailedInfo = ({ request }: { request: CallbackErrorRequest }) => {
  const deployment = EntropyDeployments[request.chain];
  const retryCommand = `cast send ${deployment.address} 'revealWithCallback(address, uint64, bytes32, bytes32)' ${request.provider} ${request.sequenceNumber.toString()} ${request.userRandomNumber} ${request.randomNumber} -r ${deployment.rpc} --private-key <YOUR_PRIVATE_KEY>`;

  return (
    <>
      <InfoBox
        header="Callback failed!"
        icon={<Warning />}
        className={styles.message}
        variant="warning"
      >
        <CallbackFailureMessage request={request} />
      </InfoBox>
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
          <CopyButton text={retryCommand}>Copy Forge Command</CopyButton>
          <Button size="sm" variant="outline">
            Connect Wallet
          </Button>
          <Button
            size="sm"
            variant="ghost"
            beforeIcon={<Question />}
            rounded
            hideText
            href="https://docs.pyth.network/entropy/debug-callback-failures"
            target="_blank"
          >
            Help
          </Button>
        </div>
      </InfoBox>
    </>
  );
};

const CallbackFailureMessage = ({
  request,
}: {
  request: CallbackErrorRequest;
}) => {
  if (request.returnValue === "" && request.gasUsed > request.gasLimit) {
    return "The callback used more gas than the gas limit.";
  } else {
    const details = getErrorDetails(request.returnValue);
    return details ? (
      <>
        <p>The callback encountered the following error:</p>
        <p className={styles.details}>
          <b>{details[0]}</b> (<code>{request.returnValue}</code>): {details[1]}
        </p>
      </>
    ) : (
      <>
        The callback encountered an unknown error:{" "}
        <code>{request.returnValue}</code>
      </>
    );
  }
};
