"use client";

import {
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  Field,
  Label,
} from "@headlessui/react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import PythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";
import PythErrorsAbi from "@pythnetwork/pyth-sdk-solidity/abis/PythErrors.json";
import { ChainIcon } from "connectkit";
import type {
  Dispatch,
  SetStateAction,
  ComponentProps,
  ElementType,
  SVGAttributes,
} from "react";
import { useState, useCallback, useMemo } from "react";
import { useSwitchChain, useChainId, useConfig } from "wagmi";
import { readContract } from "wagmi/actions";

import type { Parameter } from "./parameter";
import { ParameterInput } from "./parameter-input";
import type { EvmApiType } from "./run-button";
import { RunButton } from "./run-button";
import { getLogger } from "../../browser-logger";
import { getContractAddress } from "../../evm-networks";
import { useIsMounted } from "../../use-is-mounted";
import type { SupportedLanguage } from "../Code";
import { Code } from "../Code";
import { ErrorTooltip } from "../ErrorTooltip";
import { InlineLink } from "../InlineLink";
import { Markdown } from "../Markdown";
import { Select } from "../Select";

export { ParameterType } from "./parameter";
export { EvmApiType } from "./run-button";

const abi = [...PythAbi, ...PythErrorsAbi] as const;

type Props<ParameterName extends string> =
  | ReadApi<ParameterName>
  | WriteApi<ParameterName>;

type Common<ParameterName extends string> = {
  name: (typeof PythAbi)[number]["name"];
  summary: string;
  description: string;
  parameters: Parameter<ParameterName>[];
  examples?: Example<ParameterName>[] | undefined;
  code: CodeSample<ParameterName>[];
};

export type ReadApi<ParameterName extends string> = Common<ParameterName> & {
  type: EvmApiType.Read;
};

export type WriteApi<ParameterName extends string> = Common<ParameterName> & {
  type: EvmApiType.Write;
  valueParam: ParameterName;
};

type Example<ParameterName extends string> = {
  name: string;
  icon?: ElementType<SVGAttributes<SVGSVGElement>>;
  parameters: ValueOrFunctionOrAsyncFunction<Record<ParameterName, string>>;
};

type ValueOrFunctionOrAsyncFunction<T> =
  | T
  | ((ctx: ContractContext) => T)
  | ((ctx: ContractContext) => Promise<T>);

type ContractContext = {
  readContract: (functionName: string, args: unknown[]) => Promise<unknown>;
};

export enum Language {
  Solidity,
  EthersJSV6,
}

type CodeSample<ParameterName extends string> = {
  language: Language;
  dimRange: ComponentProps<typeof Code>["dimRange"];
  code: (
    network: NetworkInfo,
    params: Partial<Record<ParameterName, string>>,
  ) => string;
};

export type NetworkInfo = {
  name: string;
  rpcUrl: string;
  contractAddress: string;
};

export const EvmApi = <ParameterName extends string>({
  name,
  summary,
  description,
  parameters,
  code,
  examples,
  ...props
}: Props<ParameterName>) => {
  const [paramValues, setParamValues] = useState<
    Partial<Record<ParameterName, string>>
  >({});
  const chainId = useChainId();
  const { chains, switchChain } = useSwitchChain();
  const isMounted = useIsMounted();
  const currentChain = useMemo(() => {
    const chain = isMounted
      ? chains.find((chain) => chain.id === chainId)
      : chains[0];
    if (chain === undefined) {
      throw new Error(`Invalid current chain id: ${chainId.toString()}`);
    }
    return chain;
  }, [chainId, chains, isMounted]);

  return (
    <>
      <h1 className="mb-6 font-mono text-4xl font-medium">{name}</h1>
      <div className="mb-6 opacity-60">
        <Markdown>{summary}</Markdown>
      </div>
      <div className="grid grid-cols-1 gap-20 lg:grid-cols-[3fr_2fr] 2xl:grid-cols-[1fr_28rem]">
        <section>
          <h2 className="mb-4 border-b border-neutral-200 text-2xl/loose font-medium dark:border-neutral-800">
            Description
          </h2>
          <Markdown>{description}</Markdown>
        </section>
        <section className="flex min-w-0 flex-col">
          <h2 className="mb-4 border-b border-neutral-200 text-2xl/loose font-medium dark:border-neutral-800">
            Arguments
          </h2>
          <div className="mb-8">
            {parameters.length > 0 ? (
              <ul className="flex flex-col gap-4">
                {parameters.map((parameter) => (
                  <li key={parameter.name} className="contents">
                    <ParameterInput
                      spec={parameter}
                      value={paramValues[parameter.name]}
                      setParamValues={setParamValues}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg bg-neutral-200 p-8 text-center text-sm dark:bg-neutral-800">
                This API takes no arguments
              </div>
            )}
          </div>
          {examples && examples.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold">Examples</h3>
              <ul className="ml-2 text-sm">
                {examples.map((example) => (
                  <li key={example.name}>
                    <Example
                      example={example}
                      setParamValues={setParamValues}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Field className="mb-4 flex w-full flex-row items-center gap-2">
            <Label className="text-sm font-bold">Network</Label>
            <Select
              value={currentChain}
              onChange={({ id }) => {
                switchChain({ chainId: id });
              }}
              renderButtonContents={({ id, name }) => (
                <div className="flex h-8 grow basis-0 flex-row items-center gap-2 overflow-hidden">
                  {isMounted && (
                    <>
                      <ChainIcon id={id} />
                      <div className="grow basis-0 truncate">{name}</div>
                    </>
                  )}
                </div>
              )}
              renderOption={({ id, name }) => (
                <div key={id} className="flex flex-row items-center gap-2">
                  <ChainIcon id={id} />
                  <span>{name}</span>
                </div>
              )}
              optionGroups={[
                {
                  name: "Mainnet",
                  options: chains
                    .filter((chain) => !chain.testnet)
                    .sort((a, b) => a.name.localeCompare(b.name)),
                },
                {
                  name: "Testnet",
                  options: chains
                    .filter((chain) => chain.testnet)
                    .sort((a, b) => a.name.localeCompare(b.name)),
                },
              ]}
              filter={(chains, value) =>
                chains.filter((chain) =>
                  chain.name.toLowerCase().includes(value.toLowerCase()),
                )
              }
              className="min-w-0 grow"
            />
          </Field>
          <RunButton
            functionName={name}
            parameters={parameters}
            paramValues={paramValues}
            {...props}
          />
        </section>
        <TabGroup className="lg:col-span-2">
          <TabList className="mb-4 flex flex-row gap-2 border-b border-neutral-200 pb-px dark:border-neutral-800">
            {code.map(({ language }) => (
              <Tab
                key={LANGUAGE_TO_DISPLAY_NAME[language]}
                className="mb-[-2px] border-b-2 border-transparent px-2 text-sm font-medium leading-loose hover:text-pythpurple-600 data-[selected]:cursor-default data-[selected]:border-pythpurple-600 data-[selected]:text-pythpurple-600 dark:hover:text-pythpurple-400 dark:data-[selected]:border-pythpurple-400 dark:data-[selected]:text-pythpurple-400"
              >
                {LANGUAGE_TO_DISPLAY_NAME[language]}
              </Tab>
            ))}
          </TabList>
          <TabPanels>
            {code.map(({ code: codeContents, language, dimRange }) => (
              <TabPanel key={LANGUAGE_TO_DISPLAY_NAME[language]}>
                <Code
                  language={LANUGAGE_TO_SHIKI_NAME[language]}
                  dimRange={dimRange}
                >
                  {codeContents(
                    isMounted
                      ? {
                          name: currentChain.name,
                          rpcUrl: currentChain.rpcUrls.default.http[0] ?? "",
                          contractAddress: getContractAddress(chainId) ?? "",
                        }
                      : { name: "", rpcUrl: "", contractAddress: "" },
                    paramValues,
                  )}
                </Code>
              </TabPanel>
            ))}
          </TabPanels>
        </TabGroup>
      </div>
    </>
  );
};

const LANGUAGE_TO_DISPLAY_NAME = {
  [Language.Solidity]: "Solidity",
  [Language.EthersJSV6]: "ethers.js v6",
};

const LANUGAGE_TO_SHIKI_NAME: Record<Language, SupportedLanguage> = {
  [Language.Solidity]: "solidity",
  [Language.EthersJSV6]: "javascript",
};

type ExampleProps<ParameterName extends string> = {
  example: Example<ParameterName>;
  setParamValues: Dispatch<
    SetStateAction<Partial<Record<ParameterName, string>>>
  >;
};

const Example = <ParameterName extends string>({
  example,
  setParamValues,
}: ExampleProps<ParameterName>) => {
  const config = useConfig();
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const updateValues = useCallback(() => {
    if (typeof example.parameters === "function") {
      setError(undefined);
      const address = getContractAddress(config.state.chainId);
      if (!address) {
        throw new Error(
          `No contract for chain id: ${config.state.chainId.toString()}`,
        );
      }
      const params = example.parameters({
        readContract: (functionName, args) =>
          readContract(config, { abi, address, functionName, args }),
      });
      if (params instanceof Promise) {
        setLoading(true);
        params
          .then((paramsResolved) => {
            setParamValues(paramsResolved);
          })
          .catch((error_: unknown) => {
            getLogger().error(error_);
            setError(
              "An error occurred while fetching data for this example, please try again",
            );
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        setParamValues(params);
      }
    } else {
      setParamValues(example.parameters);
    }
  }, [example, setParamValues, config]);
  const Icon = example.icon;

  return (
    <div className="flex flex-row items-center gap-2">
      <InlineLink
        as="button"
        onClick={updateValues}
        className="flex flex-row items-center gap-2"
      >
        {Icon && <Icon className="h-4" />}
        <span>{example.name}</span>
      </InlineLink>
      {error && <ErrorTooltip className="size-4">{error}</ErrorTooltip>}
      {loading && <ArrowPathIcon className="size-4 animate-spin" />}
    </div>
  );
};
