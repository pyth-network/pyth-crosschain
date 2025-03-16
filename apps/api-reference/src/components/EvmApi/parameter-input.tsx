import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import base58 from "bs58";
import clsx from "clsx";
import Image from "next/image";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useState, useCallback, useMemo, useEffect } from "react";

import type { Parameter } from "./parameter";
import {
  PLACEHOLDERS,
  isValid,
  getValidationError,
  ParameterType,
} from "./parameter";
import type { PriceFeed } from "../../use-price-feed-list";
import {
  PriceFeedListContextType,
  usePriceFeedList,
} from "../../use-price-feed-list";
import { InlineLink } from "../InlineLink";
import { Input } from "../Input";
import { Markdown } from "../Markdown";

type ParameterProps<ParameterName extends string> = {
  spec: Parameter<ParameterName>;
  value: string | undefined;
  setParamValues: Dispatch<
    SetStateAction<Partial<Record<ParameterName, string>>>
  >;
};

export const ParameterInput = <ParameterName extends string>(
  props: ParameterProps<ParameterName>,
) => {
  switch (props.spec.type) {
    case ParameterType.PriceFeedId:
    case ParameterType.PriceFeedIdArray: {
      return <PriceFeedIdInput {...props} />;
    }
    default: {
      return <DefaultParameterInput {...props} />;
    }
  }
};

const PriceFeedIdInput = <ParameterName extends string>({
  spec,
  value,
  setParamValues,
}: ParameterProps<ParameterName>) => {
  const { validationError, internalValue, onChange } = useParameterInput(
    spec,
    value,
    setParamValues,
  );
  const { selectedPriceFeed, onSelectPriceFeed, priceFeedList } =
    usePriceFeedSelector(internalValue, onChange);
  const onChangeInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  return (
    <Combobox
      value={selectedPriceFeed}
      onChange={onSelectPriceFeed}
      as="div"
      className="group relative"
      immediate
      virtual={{
        options:
          priceFeedList.type === PriceFeedListContextType.Loaded
            ? priceFeedList.list
            : [],
      }}
    >
      <ComboboxInput
        as={Input}
        displayValue={() =>
          selectedPriceFeed
            ? `${selectedPriceFeed.name} (${selectedPriceFeed.feedId})`
            : internalValue
        }
        onChange={onChangeInput}
        validationError={validationError}
        label={spec.name}
        description={<Markdown inline>{spec.description}</Markdown>}
        placeholder={PLACEHOLDERS[spec.type]}
        required={true}
      />
      <div className="absolute right-0 top-0 z-50 mt-20 hidden w-full min-w-[34rem] overflow-hidden rounded-lg border border-neutral-400 bg-neutral-100 text-sm shadow focus-visible:border-pythpurple-600 focus-visible:outline-none group-data-[open]:block dark:border-neutral-600 dark:bg-neutral-800 dark:shadow-white/20 dark:focus-visible:border-pythpurple-400">
        <PriceFeedListOptions priceFeedList={priceFeedList} />
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className="bg-neutral-200 p-1 px-2 text-right text-xs dark:bg-neutral-700"
          onMouseDown={(e) => {
            e.preventDefault();
          }}
        >
          See all price feed IDs on{" "}
          <InlineLink
            target="_blank"
            href="https://pyth.network/developers/price-feed-ids"
          >
            the reference page
          </InlineLink>
        </div>
      </div>
    </Combobox>
  );
};

type PriceFeedListOptionsProps = {
  priceFeedList: ReturnType<typeof usePriceFeedSelector>["priceFeedList"];
};

const PriceFeedListOptions = ({ priceFeedList }: PriceFeedListOptionsProps) => {
  if (priceFeedList.type === PriceFeedListContextType.Loaded) {
    return priceFeedList.list.length === 0 ? (
      <div className="flex w-full items-center justify-center py-10">
        No matching price feeds
      </div>
    ) : (
      <ComboboxOptions className="h-80 overflow-y-auto py-1" modal={false}>
        {({ option }: { option: PriceFeed }) => {
          const { feedId, name, description } = option;
          return (
            <ComboboxOption
              key={feedId}
              value={option}
              className="group flex w-32 min-w-full cursor-pointer flex-row items-center gap-3 p-2 py-1 data-[focus]:bg-neutral-300 data-[selected]:text-pythpurple-600 dark:data-[focus]:bg-neutral-700 dark:data-[selected]:text-pythpurple-400"
            >
              <PriceFeedIcon name={name} />
              <div>
                <div className="flex flex-row items-center gap-3">
                  <div className="font-medium">{name}</div>
                  <div className="text-xs">{description}</div>
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  {feedId}
                </div>
              </div>
            </ComboboxOption>
          );
        }}
      </ComboboxOptions>
    );
  } else {
    return (
      <div className="flex w-full items-center justify-center py-10">
        <ArrowPathIcon className="size-6 animate-spin" />
      </div>
    );
  }
};

type PriceFeedIconProps = {
  name: string;
};

const PriceFeedIcon = ({ name }: PriceFeedIconProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const setLoaded = useCallback(() => {
    setIsLoaded(true);
  }, [setIsLoaded]);
  const icon = useMemo(() => {
    const nameParts = name.split(".");
    return nameParts.at(-1)?.split("/")[0]?.toLowerCase() ?? "generic";
  }, [name]);

  return (
    <div className="relative size-6">
      <Image
        src={`/currency-icons/${icon}.svg`}
        alt=""
        className={clsx("absolute inset-0 transition", {
          "opacity-0": !isLoaded,
        })}
        width={24}
        height={24}
        onLoad={setLoaded}
      />
      <Image
        src={`/currency-icons/generic.svg`}
        alt=""
        className="size-full"
        width={24}
        height={24}
      />
    </div>
  );
};

const DefaultParameterInput = <ParameterName extends string>({
  spec,
  value,
  setParamValues,
}: ParameterProps<ParameterName>) => {
  const { validationError, internalValue, onChange } = useParameterInput(
    spec,
    value,
    setParamValues,
  );
  const onChangeInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  return (
    <Input
      validationError={validationError}
      label={spec.name}
      description={<Markdown inline>{spec.description}</Markdown>}
      placeholder={PLACEHOLDERS[spec.type]}
      required={true}
      value={internalValue}
      onChange={onChangeInput}
    />
  );
};

const useParameterInput = <ParameterName extends string>(
  spec: Parameter<ParameterName>,
  value: string | undefined,
  setParamValues: Dispatch<
    SetStateAction<Partial<Record<ParameterName, string>>>
  >,
) => {
  const [internalValue, setInternalValue] = useState(value ?? "");
  const validationError = useMemo(
    () => (internalValue ? getValidationError(spec, internalValue) : undefined),
    [internalValue, spec],
  );
  const onChange = useCallback(
    (value: string) => {
      setInternalValue(value);
      setParamValues((paramValues) => ({
        ...paramValues,
        [spec.name]: value === "" || !isValid(spec, value) ? undefined : value,
      }));
    },
    [setParamValues, spec],
  );

  useEffect(() => {
    if (value) {
      setInternalValue(value);
    }
  }, [value]);

  return { internalValue, validationError, onChange };
};

const usePriceFeedSelector = (
  internalValue: string,
  onChange: (value: string) => void,
) => {
  const priceFeedList = usePriceFeedList();
  const sortedPriceFeedListWithHexIds = useMemo(() => {
    return priceFeedList.type === PriceFeedListContextType.Loaded
      ? priceFeedList.priceFeedList
          .map((feed) => ({ ...feed, feedId: pubKeyToHex(feed.feedId) }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];
  }, [priceFeedList]);
  const selectedPriceFeed = useMemo(
    () =>
      sortedPriceFeedListWithHexIds.find(
        ({ feedId }) => feedId === internalValue,
        // eslint-disable-next-line unicorn/no-null
      ) ?? null,
    [sortedPriceFeedListWithHexIds, internalValue],
  );
  const onSelectPriceFeed = useCallback(
    (priceFeed: PriceFeed | null) => {
      if (priceFeed) {
        onChange(priceFeed.feedId);
      }
    },
    [onChange],
  );
  const filteredPriceFeedList = useMemo(() => {
    if (selectedPriceFeed === null) {
      const query = internalValue.toLowerCase();
      return sortedPriceFeedListWithHexIds.filter(
        ({ name, description }) =>
          name.toLowerCase().includes(query) ||
          description.toLowerCase().includes(query),
      );
    } else {
      return sortedPriceFeedListWithHexIds;
    }
  }, [selectedPriceFeed, internalValue, sortedPriceFeedListWithHexIds]);
  const transformedPriceFeedList = useMemo(
    () =>
      priceFeedList.type === PriceFeedListContextType.Loaded
        ? {
            type: PriceFeedListContextType.Loaded as const,
            list: filteredPriceFeedList,
          }
        : priceFeedList,
    [priceFeedList, filteredPriceFeedList],
  );

  return {
    selectedPriceFeed,
    onSelectPriceFeed,
    priceFeedList: transformedPriceFeedList,
  };
};

const pubKeyToHex = (pubKey: string) =>
  [
    "0x",
    ...Array.from(base58.decode(pubKey), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ),
  ].join("");
