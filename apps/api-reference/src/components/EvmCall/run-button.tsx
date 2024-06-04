"use client";

import { ArrowPathIcon } from "@heroicons/react/24/outline";
import PythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";
import PythErrorsAbi from "@pythnetwork/pyth-sdk-solidity/abis/PythErrors.json";
import { readContract, createConfig, http } from "@wagmi/core";
import { useCallback, useMemo, useState } from "react";
import { ContractFunctionExecutionError, type Transport } from "viem";

import { type Network, NETWORK_TO_CONTRACT_ADDRESS } from "./networks";
import { type Parameter } from "./parameter-input";
import { Button } from "../Button";
import { Code } from "../Code";
import { Modal } from "../Modal";

type RunButtonProps<
  ParameterName extends string,
  Parameters extends Record<ParameterName, string>,
> = {
  functionName: (typeof PythAbi)[number]["name"];
  network: Network;
  parameters: Parameter<ParameterName>[];
  paramValues: Partial<Parameters>;
};

export const RunButton = <
  ParameterName extends string,
  Parameters extends Record<ParameterName, string>,
>({
  network,
  functionName,
  parameters,
  paramValues,
}: RunButtonProps<ParameterName, Parameters>) => {
  const {
    status,
    modalContents,
    resetStatus,
    clearModalContents,
    runContract,
    disabled,
  } = useRunButton(functionName, network, parameters, paramValues);

  return (
    <>
      <Button
        disabled={disabled}
        loading={status === Status.Loading}
        className="flex h-10 w-full flex-row items-center justify-center gap-2"
        onClick={runContract}
      >
        {status === Status.Loading ? (
          <ArrowPathIcon className="size-4 animate-spin" />
        ) : (
          "Run"
        )}
      </Button>
      <Modal
        show={modalContents !== undefined && status === Status.ShowingResults}
        onClose={resetStatus}
        afterLeave={clearModalContents}
        title={
          typeof modalContents === "object" && "result" in modalContents
            ? "Results"
            : "Error"
        }
        description={`${functionName} - ${modalContents?.network.name ?? ""}`}
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
    </>
  );
};

const useRunButton = <
  ParameterName extends string,
  Parameters extends Record<ParameterName, string>,
>(
  functionName: (typeof PythAbi)[number]["name"],
  network: Network,
  parameters: Parameter<ParameterName>[],
  paramValues: Partial<Parameters>,
) => {
  const [status, setStatus] = useState<Status>(Status.None);
  const [modalContents, setModalContents] = useState<
    ModalContents<ParameterName, Parameters> | undefined
  >(undefined);
  const resetStatus = useCallback(() => {
    setStatus(Status.None);
  }, [setStatus]);
  const clearModalContents = useCallback(() => {
    setModalContents(undefined);
  }, [setModalContents]);
  const preparedParams = useMemo(() => {
    const orderedParams = parameters.map(({ name }) => paramValues[name]);
    return isComplete(orderedParams) ? orderedParams : undefined;
  }, [parameters, paramValues]);
  const runContract = useCallback(() => {
    setStatus(Status.Loading);
    if (preparedParams === undefined) {
      setModalContents({ error: new Error("Invalid parameters!"), network });
      setStatus(Status.ShowingResults);
    } else {
      runFunction(network, functionName, preparedParams)
        .then((result) => {
          setModalContents({ result, parameters: paramValues, network });
        })
        .catch((error: unknown) => {
          setModalContents({ error: error, parameters: paramValues, network });
        })
        .finally(() => {
          setStatus(Status.ShowingResults);
        });
    }
  }, [network, functionName, setStatus, preparedParams, paramValues]);
  const disabled = preparedParams === undefined || status !== Status.None;

  return {
    status,
    modalContents,
    resetStatus,
    clearModalContents,
    runContract,
    disabled,
  };
};

type ModalContents<
  ParameterName extends string,
  Parameters extends Record<ParameterName, string>,
> = { network: Network } & (
  | { error: unknown; parameters?: Partial<Parameters> }
  | { result: unknown; parameters: Partial<Parameters> }
);

enum Status {
  None,
  Loading,
  ShowingResults,
}

const runFunction = async (
  network: Network,
  functionName: (typeof PythAbi)[number]["name"],
  args: string[],
) =>
  readContract(
    createConfig({
      chains: [network],
      transports: { [network.id]: http() } as Record<
        (typeof network)["id"],
        Transport
      >,
    }),
    {
      abi: [...PythAbi, ...PythErrorsAbi] as const,
      address: NETWORK_TO_CONTRACT_ADDRESS[network.id],
      functionName,
      args,
    },
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

const isComplete = <T,>(arr: (T | undefined)[]): arr is NonNullable<T>[] =>
  arr.every((value) => value !== undefined);
