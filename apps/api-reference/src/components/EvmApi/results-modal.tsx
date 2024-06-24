import { ContractFunctionExecutionError } from "viem";

import { Code } from "../Code";
import { Modal } from "../Modal";

type Props<ParameterName extends string> = {
  modalContents?: ModalContents<ParameterName> | undefined;
  isShowingResults: boolean;
  resetStatus: () => void;
  clearModalContents: () => void;
  functionName: string;
};

export type ModalContents<ParameterName extends string> = {
  networkName: string;
} & (
  | { error: unknown; parameters?: Partial<Record<ParameterName, string>> }
  | { result: unknown; parameters: Partial<Record<ParameterName, string>> }
);

export const ResultsModal = <ParameterName extends string>({
  modalContents,
  isShowingResults,
  resetStatus,
  clearModalContents,
  functionName,
}: Props<ParameterName>) => (
  <Modal
    show={modalContents !== undefined && isShowingResults}
    onClose={resetStatus}
    afterLeave={clearModalContents}
    title={
      typeof modalContents === "object" && "result" in modalContents
        ? "Results"
        : "Error"
    }
    description={`${functionName} - ${modalContents?.networkName ?? ""}`}
  >
    {modalContents !== undefined && (
      <>
        {"parameters" in modalContents &&
          Object.keys(modalContents.parameters).length > 0 && (
            <div className="mb-10 rounded-lg bg-neutral-100 p-8 dark:bg-neutral-800/50">
              <h2 className="mb-2 border-b border-neutral-300 font-semibold text-neutral-700 dark:border-neutral-600 dark:text-neutral-300">
                Arguments
              </h2>
              <ul className="overflow-hidden text-xs">
                {Object.entries(modalContents.parameters).map(
                  ([name, value]) => (
                    <li className="overflow-hidden truncate" key={name}>
                      <span className="mr-2 font-medium text-neutral-700 dark:text-neutral-300">
                        {name}:
                      </span>
                      <span className="text-neutral-600 dark:text-neutral-400">
                        {value as string}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
        {"result" in modalContents ? (
          <Code language="javascript">
            {stringifyResponse(modalContents.result)}
          </Code>
        ) : (
          <div className="mb-10 rounded-lg bg-neutral-100/25 p-8 dark:bg-neutral-800">
            <p className="font-mono text-sm font-medium text-red-600 dark:text-red-400">
              {showError(modalContents.error)}
            </p>
          </div>
        )}
      </>
    )}
  </Modal>
);

const showError = (error: unknown): string => {
  if (typeof error === "string") {
    return error;
  } else if (error instanceof ContractFunctionExecutionError) {
    return error.cause.metaMessages?.[0] ?? error.message;
  } else if (error instanceof Error) {
    return error.toString();
  } else {
    return "An unknown error occurred";
  }
};

const stringifyResponse = (response: unknown): string => {
  switch (typeof response) {
    case "string": {
      return `"${response}"`;
    }
    case "number":
    case "boolean":
    case "function": {
      return response.toString();
    }
    case "bigint": {
      return `${response.toString()}n`;
    }
    case "symbol": {
      return `Symbol(${response.toString()})`;
    }
    case "undefined": {
      return "undefined";
    }
    case "object": {
      return response === null
        ? "null"
        : `{\n${Object.entries(response)
            .map(([key, value]) => `    ${key}: ${stringifyResponse(value)}`)
            .join(",\n")}\n}`;
    }
  }
};
