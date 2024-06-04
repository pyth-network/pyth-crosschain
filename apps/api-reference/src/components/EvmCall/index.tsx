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
import PythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";
import { mainnet } from "@wagmi/core/chains";
import { type ReactNode, useState } from "react";

import {
  type Network,
  NETWORKS,
  NETWORK_TO_CONTRACT_ADDRESS,
} from "./networks";
import { type Parameter, ParameterInput } from "./parameter-input";
import { RunButton } from "./run-button";
import { type SupportedLanguage, Code } from "../Code";
import { InlineLink } from "../InlineLink";
import { Select } from "../Select";

export { ParameterType } from "./parameter-input";

type Props<
  ParameterName extends string,
  Parameters extends Record<ParameterName, string>,
> = {
  name: (typeof PythAbi)[number]["name"];
  children: ReactNode;
  parameters: Parameter<ParameterName>[];
  examples: Example<ParameterName, Parameters>[];
  code: CodeSample<ParameterName, Parameters>[];
};

type Example<
  ParameterName extends string,
  Parameters extends Record<ParameterName, string>,
> = {
  name: string;
  parameters: Parameters;
};

export enum Language {
  Solidity,
  EthersJSV6,
}

type CodeSample<
  ParameterName extends string,
  Parameters extends Record<ParameterName, string>,
> = {
  language: Language;
  code: (
    network: {
      name: string;
      rpcUrl: string;
      contractAddress: string;
    },
    params: Partial<Parameters>,
  ) => string;
};

export const EvmCall = <
  ParameterName extends string,
  Parameters extends Record<ParameterName, string>,
>({
  name,
  children,
  parameters,
  code,
  examples,
}: Props<ParameterName, Parameters>) => {
  const [paramValues, setParamValues] = useState<Partial<Parameters>>({});
  const [network, setNetwork] = useState<Network>(mainnet);

  return (
    <div className="gap-x-20 lg:grid lg:grid-cols-[2fr_1fr]">
      <h1 className="col-span-2 mb-6 font-mono text-4xl font-medium">{name}</h1>
      <section>
        <h2 className="mb-4 border-b border-neutral-200 text-2xl/loose font-medium dark:border-neutral-800">
          Description
        </h2>
        {children}
      </section>
      <section className="flex flex-col">
        <h2 className="mb-4 border-b border-neutral-200 text-2xl/loose font-medium dark:border-neutral-800">
          Arguments
        </h2>
        <div className="mb-8">
          {parameters.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {parameters.map((parameter) => (
                <li key={name} className="contents">
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
        <div className="grow" />
        {examples.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold">Examples</h3>
            <ul className="ml-2 text-sm">
              {examples.map(({ name, parameters: exampleParameters }) => (
                <li key={name}>
                  <InlineLink
                    as="button"
                    onClick={() => {
                      setParamValues(exampleParameters);
                    }}
                  >
                    {name}
                  </InlineLink>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Field className="mb-4 flex w-full flex-row items-center gap-2">
          <Label className="text-sm font-bold">Network</Label>
          <Select
            value={network}
            onChange={setNetwork}
            renderOption={({ name }) => name}
            options={NETWORKS}
            buttonClassName="grow"
          />
        </Field>
        <RunButton
          network={network}
          functionName={name}
          parameters={parameters}
          paramValues={paramValues}
        />
      </section>
      <TabGroup className="col-span-2 mt-24">
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
          {code.map(({ code: codeContents, language }) => (
            <TabPanel key={LANGUAGE_TO_DISPLAY_NAME[language]}>
              <Code language={LANUGAGE_TO_SHIKI_NAME[language]}>
                {codeContents(
                  {
                    name: network.name,
                    rpcUrl: network.rpcUrls.default.http[0],
                    contractAddress: NETWORK_TO_CONTRACT_ADDRESS[network.id],
                  },
                  paramValues,
                )}
              </Code>
            </TabPanel>
          ))}
        </TabPanels>
      </TabGroup>
    </div>
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
