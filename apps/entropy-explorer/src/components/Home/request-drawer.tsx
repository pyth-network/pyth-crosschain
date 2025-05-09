import { Code } from "@phosphor-icons/react/dist/ssr/Code";
import { Warning } from "@phosphor-icons/react/dist/ssr/Warning";
import { CopyButton } from "@pythnetwork/component-library/CopyButton";
import { InfoBox } from "@pythnetwork/component-library/InfoBox";
import { Meter } from "@pythnetwork/component-library/Meter";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { Table } from "@pythnetwork/component-library/Table";
import type { OpenDrawerArgs } from "@pythnetwork/component-library/useDrawer";
import { useDateFormatter, useNumberFormatter } from "react-aria";

import styles from "./request-drawer.module.scss";
import { EntropyDeployments } from "../../entropy-deployments";
import type { Request, CompletedRequest } from "../../get-requests";
import { truncate } from "../../truncate";
import { Address } from "../Address";
import { Status } from "../Status";

export const mkRequestDrawer = (request: Request): OpenDrawerArgs => ({
  title: `Request ${truncate(request.txHash)}`,
  headingExtra: <Status request={request} />,
  bodyClassName: styles.requestDrawer ?? "",
  fill: true,
  contents: <RequestDrawerBody request={request} />,
});

const RequestDrawerBody = ({ request }: { request: Request }) => {
  const dateFormatter = useDateFormatter({
    dateStyle: "long",
    timeStyle: "long",
  });
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
            request.hasCallbackCompleted ? (
              <CopyButton text={request.callbackResult.randomNumber}>
                <code>{truncate(request.callbackResult.randomNumber)}</code>
              </CopyButton>
            ) : (
              <Status request={request} />
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
      <Table
        label="Details"
        fill
        className={styles.details ?? ""}
        stickyHeader
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
            field: "Request Timestamp",
            value: dateFormatter.format(request.timestamp),
          },
          ...(request.hasCallbackCompleted
            ? [
                {
                  field: "Callback Timestamp",
                  value: dateFormatter.format(request.callbackResult.timestamp),
                },
              ]
            : []),
          {
            field: "Request Tx Hash",
            value: <Address chain={request.chain} value={request.txHash} />,
          },
          ...(request.hasCallbackCompleted
            ? [
                {
                  field: "Callback Tx Hash",
                  value: (
                    <Address
                      chain={request.chain}
                      value={request.callbackResult.txHash}
                    />
                  ),
                },
              ]
            : []),
          {
            field: "Caller",
            value: <Address chain={request.chain} value={request.caller} />,
          },
          {
            field: "Provider",
            value: <Address chain={request.chain} value={request.provider} />,
          },
          {
            field: "User Random Number",
            value: (
              <CopyButton text={request.userRandomNumber}>
                <code>{truncate(request.userRandomNumber)}</code>
              </CopyButton>
            ),
          },
          {
            field: "Gas",
            value: request.hasCallbackCompleted ? (
              <Meter
                label="Gas"
                value={request.callbackResult.gasUsed}
                maxValue={request.gasLimit}
                className={styles.gasMeter ?? ""}
                startLabel={
                  <>
                    {gasFormatter.format(request.callbackResult.gasUsed)} used
                  </>
                }
                endLabel={<>{gasFormatter.format(request.gasLimit)} max</>}
                labelClassName={styles.gasMeterLabel ?? ""}
                variant={
                  request.callbackResult.gasUsed > request.gasLimit
                    ? "error"
                    : "default"
                }
              />
            ) : (
              <>{gasFormatter.format(request.gasLimit)} max</>
            ),
          },
        ].map((data) => ({
          id: data.field,
          data: {
            field: <span className={styles.field}>{data.field}</span>,
            value: data.value,
          },
        }))}
      />
      {request.hasCallbackCompleted && request.callbackResult.failed && (
        <CallbackFailedInfo request={request} />
      )}
    </>
  );
};

const CallbackFailedInfo = ({ request }: { request: CompletedRequest }) => {
  const deployment = EntropyDeployments[request.chain];
  const retryCommand = `cast send ${deployment.address} 'revealWithCallback(address, uint64, bytes32, bytes32)' ${request.provider} ${request.sequenceNumber.toString()} ${request.userRandomNumber} ${request.callbackResult.randomNumber} -r ${deployment.rpc} --private-key <YOUR_PRIVATE_KEY>`;

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
        header="To retry this callback, run:"
        icon={<Code />}
        className={styles.message}
        variant="info"
      >
        <CopyButton className={styles.copyButton ?? ""} text={retryCommand} />
        <code className={styles.code}>{retryCommand}</code>
      </InfoBox>
    </>
  );
};

const CallbackFailureMessage = ({ request }: { request: CompletedRequest }) =>
  request.callbackResult.returnValue === "" &&
  request.callbackResult.gasUsed > request.gasLimit
    ? "The callback used more gas than the gas limit."
    : `An error occurred: ${request.callbackResult.returnValue}`;
