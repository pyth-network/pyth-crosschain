import {
  Bars3Icon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { lookup } from "@pythnetwork/known-publishers";
import { calculateApy } from "@pythnetwork/staking-sdk";
import { PublicKey } from "@solana/web3.js";
import clsx from "clsx";
import type {
  ComponentProps,
  Dispatch,
  FormEvent,
  SetStateAction,
} from "react";
import { createElement, useCallback, useMemo, useRef, useState } from "react";
import { useCollator, useFilter } from "react-aria";
import {
  Button as BaseButton,
  Form,
  Input,
  Label,
  MenuTrigger,
  Meter,
  SearchField,
  TextField,
} from "react-aria-components";

import type { States } from "../../hooks/use-api";
import { StateType as ApiStateType } from "../../hooks/use-api";
import {
  StateType as UseAsyncStateType,
  useAsync,
} from "../../hooks/use-async";
import { useToast } from "../../hooks/use-toast";
import { Button, LinkButton } from "../Button";
import { CopyButton } from "../CopyButton";
import { ErrorMessage } from "../ErrorMessage";
import { Menu, MenuItem, Section, Separator } from "../Menu";
import { ModalDialog } from "../ModalDialog";
import { ProgramSection } from "../ProgramSection";
import { PublisherFaq } from "../PublisherFaq";
import { Select } from "../Select";
import { SparkChart } from "../SparkChart";
import { StakingTimeline } from "../StakingTimeline";
import { Styled } from "../Styled";
import { Tokens } from "../Tokens";
import { TransferButton } from "../TransferButton";
import { TruncatedKey } from "../TruncatedKey";

type Props = {
  api: States[ApiStateType.Loaded] | States[ApiStateType.LoadedNoStakeAccount];
  currentEpoch: bigint;
  availableToStake: bigint;
  locked: bigint;
  warmup: bigint;
  staked: bigint;
  cooldown: bigint;
  cooldown2: bigint;
  publishers: PublisherProps["publisher"][];
  yieldRate: bigint;
};

export const OracleIntegrityStaking = ({
  api,
  currentEpoch,
  availableToStake,
  locked,
  warmup,
  staked,
  cooldown,
  cooldown2,
  publishers,
  yieldRate,
}: Props) => {
  const self = useMemo(
    () =>
      api.type === ApiStateType.Loaded
        ? publishers.find((publisher) =>
            publisher.stakeAccount?.equals(api.account),
          )
        : undefined,
    [publishers, api],
  );

  const otherPublishers = useMemo(
    () =>
      self === undefined
        ? publishers
        : publishers.filter((publisher) => publisher !== self),
    [publishers, self],
  );

  const activePublishers = useMemo(
    () =>
      otherPublishers.filter((publisher) =>
        hasAnyNonCooldownPositions(publisher),
      ),
    [otherPublishers],
  );

  return (
    <ProgramSection
      className={activePublishers.length > 0 ? "pb-0 sm:pb-0" : ""}
      collapseTokenOverview
      description="OIS allows anyone to help secure Pyth and protect DeFi. Through decentralized staking rewards and slashing, OIS incentivizes Pyth publishers to maintain high-quality data contributions. PYTH holders can stake to publishers to further reinforce oracle security."
      name="Oracle Integrity Staking (OIS)"
      tagline="Protect DeFi"
      tokenOverview={{
        available: availableToStake,
        cooldown,
        cooldown2,
        currentEpoch,
        staked,
        warmup,
        ...(locked > 0n && {
          availableToStakeDetails: (
            <div className="mt-2 text-xs text-red-600">
              <Tokens>{locked}</Tokens> are locked and cannot be staked in OIS
            </div>
          ),
        }),
      }}
    >
      {self && api.type == ApiStateType.Loaded && (
        <SelfStaking
          api={api}
          availableToStake={availableToStake}
          currentEpoch={currentEpoch}
          self={self}
          yieldRate={yieldRate}
        />
      )}
      {activePublishers.length > 0 && (
        <div
          className={clsx(
            "relative -mx-4 overflow-hidden border-t border-neutral-600/50 pt-6 sm:-mx-8 lg:mt-10",
            { "mt-6 sm:mt-12": self === undefined },
          )}
        >
          <PublisherList
            api={api}
            availableToStake={availableToStake}
            currentEpoch={currentEpoch}
            publishers={activePublishers}
            title={self ? "Other Publishers" : "Publishers"}
            totalStaked={staked}
            yieldRate={yieldRate}
          />
        </div>
      )}
    </ProgramSection>
  );
};

type SelfStakingProps = {
  api: States[ApiStateType.Loaded];
  self: PublisherProps["publisher"];
  currentEpoch: bigint;
  availableToStake: bigint;
  yieldRate: bigint;
};

const SelfStaking = ({
  self,
  api,
  currentEpoch,
  availableToStake,
  yieldRate,
}: SelfStakingProps) => {
  const [publisherFaqOpen, setPublisherFaqOpen] = useState(false);
  const openPublisherFaq = useCallback(() => {
    setPublisherFaqOpen(true);
  }, [setPublisherFaqOpen]);

  const [reassignStakeAccountOpen, setReassignStakeAccountOpen] =
    useState(false);
  const openReassignStakeAccount = useCallback(() => {
    setReassignStakeAccountOpen(true);
  }, [setReassignStakeAccountOpen]);

  const [optOutOpen, setOptOutOpen] = useState(false);
  const openOptOut = useCallback(() => {
    setOptOutOpen(true);
  }, [setOptOutOpen]);

  return (
    <>
      <div className="relative -mx-4 mt-6 overflow-hidden border-t border-neutral-600/50 pt-6 sm:-mx-8 sm:mt-10">
        <div className="relative w-full overflow-x-auto">
          <div className="sticky left-0 mb-4 flex flex-row items-start justify-between px-4 sm:px-10 sm:pb-4 sm:pt-6 lg:items-center">
            <div>
              <h3 className="text-2xl font-light">Self Staking</h3>
              <PublisherIdentity
                className="opacity-60"
                fullClassName="hidden 2xl:inline"
                truncatedClassName="2xl:hidden"
              >
                {self}
              </PublisherIdentity>
            </div>
            <div className="flex flex-row items-center gap-4">
              <MenuTrigger>
                <Button className="group lg:hidden" variant="secondary">
                  <Bars3Icon className="size-6 flex-none" />
                  <span className="sr-only">Publisher Menu</span>
                  <ChevronDownIcon className="size-4 flex-none opacity-60 transition duration-300 group-data-[pressed]:-rotate-180" />
                </Button>
                <Menu placement="bottom end">
                  <Section>
                    <MenuItem onAction={openReassignStakeAccount}>
                      Reassign Stake Account
                    </MenuItem>
                    <MenuItem onAction={openOptOut}>
                      Opt Out of Rewards
                    </MenuItem>
                  </Section>
                  <Separator />
                  <Section>
                    <MenuItem onAction={openPublisherFaq}>
                      Data Publisher FAQ
                    </MenuItem>
                    <MenuItem
                      href="https://pyth-network.notion.site/Oracle-Integrity-Staking-OIS-Guide-for-Pyth-Network-MDPs-2755c872a7c44aefabfa9987ba7ec8ae"
                      target="_blank"
                    >
                      Data Publisher Guide
                    </MenuItem>
                  </Section>
                </Menu>
              </MenuTrigger>
              <LinkButton
                className="hidden lg:block"
                href="https://pyth-network.notion.site/Oracle-Integrity-Staking-OIS-Guide-for-Pyth-Network-MDPs-2755c872a7c44aefabfa9987ba7ec8ae"
                size="small"
                target="_blank"
              >
                Publisher Guide
              </LinkButton>
              <Button
                className="hidden lg:block"
                onPress={openPublisherFaq}
                size="small"
              >
                Publisher FAQ
              </Button>
              <Button
                className="hidden lg:block"
                onPress={openReassignStakeAccount}
                size="small"
                variant="secondary"
              >
                Reassign Stake Account
              </Button>
              <Button
                className="hidden lg:block"
                onPress={openOptOut}
                size="small"
                variant="secondary"
              >
                Opt Out of Rewards
              </Button>
            </div>
          </div>

          <div className="border-neutral-600/50 bg-pythpurple-400/10 sm:mx-12 sm:mb-4 sm:border sm:border-t-0 md:mx-20 xl:hidden">
            <Publisher
              api={api}
              availableToStake={availableToStake}
              compact
              currentEpoch={currentEpoch}
              isSelf
              publisher={self}
              totalStaked={self.positions?.staked ?? 0n}
              yieldRate={yieldRate}
            />
          </div>

          <table className="mx-auto hidden border border-neutral-600/50 text-sm xl:table">
            <thead className="bg-pythpurple-400/30 font-light">
              <tr>
                <PublisherTableHeader>Pool</PublisherTableHeader>
                <PublisherTableHeader>Estimated next APY</PublisherTableHeader>
                <PublisherTableHeader>Historical APY</PublisherTableHeader>
                <PublisherTableHeader>Number of feeds</PublisherTableHeader>
                <PublisherTableHeader>Quality ranking</PublisherTableHeader>
              </tr>
            </thead>
            <tbody className="bg-pythpurple-400/10">
              <Publisher
                api={api}
                availableToStake={availableToStake}
                currentEpoch={currentEpoch}
                isSelf
                publisher={self}
                totalStaked={self.positions?.staked ?? 0n}
                yieldRate={yieldRate}
              />
            </tbody>
          </table>
        </div>
      </div>
      <PublisherFaq
        isOpen={publisherFaqOpen}
        onOpenChange={setPublisherFaqOpen}
      />
      <ReassignStakeAccount
        api={api}
        isOpen={reassignStakeAccountOpen}
        onOpenChange={setReassignStakeAccountOpen}
        self={self}
      />
      <OptOut
        api={api}
        isOpen={optOutOpen}
        onOpenChange={setOptOutOpen}
        self={self}
      />
    </>
  );
};

type ReassignStakeAccountButtonProps = Omit<
  ComponentProps<typeof ModalDialog>,
  "title" | "children" | "closeButtonText" | "closeDisabled" | "description"
> & {
  api: States[ApiStateType.Loaded];
  self: PublisherProps["publisher"];
};

const ReassignStakeAccount = ({
  api,
  self,
  ...props
}: ReassignStakeAccountButtonProps) => {
  const [closeDisabled, setCloseDisabled] = useState(false);

  return hasAnyPositions(self) ? (
    <ModalDialog closeButtonText="Ok" title="You must unstake first" {...props}>
      <div className="flex max-w-prose flex-col gap-4">
        <p className="font-semibold">
          You cannot designate another account while self-staked.
        </p>
        <p className="opacity-90">
          Please close all self-staking positions, wait the cooldown period (if
          applicable), and try again once your self-stake is fully closed.
        </p>
      </div>
    </ModalDialog>
  ) : (
    <ModalDialog
      closeDisabled={closeDisabled}
      description={
        <>
          <span className="mr-[0.5em]">
            Designate a different stake account as the self-staking account for
          </span>
          <PublisherIdentity className="font-semibold">
            {self}
          </PublisherIdentity>
        </>
      }
      title="Reassign Stake Account"
      {...props}
    >
      {({ close }) => (
        <ReassignStakeAccountForm
          api={api}
          close={close}
          publisherPubkey={self.publicKey}
          setCloseDisabled={setCloseDisabled}
        />
      )}
    </ModalDialog>
  );
};

type ReassignStakeAccountFormProps = {
  api: States[ApiStateType.Loaded];
  publisherPubkey: PublicKey;
  close: () => void;
  setCloseDisabled: (value: boolean) => void;
};

const ReassignStakeAccountForm = ({
  api,
  publisherPubkey,
  close,
  setCloseDisabled,
}: ReassignStakeAccountFormProps) => {
  const [value, setValue] = useState("");

  const key = useMemo(() => {
    try {
      return new PublicKey(value);
    } catch {
      return;
    }
  }, [value]);

  const doReassign = useCallback(
    () =>
      key === undefined
        ? Promise.reject(new InvalidKeyError())
        : api.reassignPublisherAccount(key, publisherPubkey),
    [api, key, publisherPubkey],
  );

  const { state, execute } = useAsync(doReassign);

  const toast = useToast();

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setCloseDisabled(true);
      execute()
        .then(() => {
          close();
          toast.success("You have reassigned your main account");
        })
        .catch(() => {
          /* no-op since this is already handled in the UI using `state` and is logged in useAsync */
        })
        .finally(() => {
          setCloseDisabled(false);
        });
    },
    [execute, close, setCloseDisabled, toast],
  );

  return (
    <Form onSubmit={handleSubmit}>
      <TextField
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        className="mb-8 flex w-full flex-col gap-1 sm:min-w-96"
        isInvalid={key === undefined}
        name="publicKey"
        onChange={setValue}
        validationBehavior="aria"
        value={value}
      >
        <div className="flex flex-row items-center justify-between">
          <Label>New stake account public key</Label>
        </div>
        <Input
          className="focused:outline-none focused:ring-0 focused:border-pythpurple-400 w-full truncate border border-neutral-600/50 bg-transparent p-3 focus:border-pythpurple-400 focus:outline-none focus:ring-0 focus-visible:border-pythpurple-400 focus-visible:outline-none focus-visible:ring-0"
          placeholder={PublicKey.default.toBase58()}
          required
        />
        {state.type === UseAsyncStateType.Error && (
          <div className="mt-4 max-w-sm">
            <ErrorMessage error={state.error} />
          </div>
        )}
      </TextField>
      <Button
        className="mt-6 w-full"
        isDisabled={
          key === undefined || state.type === UseAsyncStateType.Complete
        }
        isLoading={state.type === UseAsyncStateType.Running}
        type="submit"
      >
        <ReassignStakeAccountButtonContents publicKey={key} value={value} />
      </Button>
    </Form>
  );
};

type ReassignStakeAccountButtonContentsProps = {
  value: string;
  publicKey: PublicKey | undefined;
};

const ReassignStakeAccountButtonContents = ({
  value,
  publicKey,
}: ReassignStakeAccountButtonContentsProps) => {
  if (value === "") {
    return "Enter the new stake account key";
  } else if (publicKey === undefined) {
    return "Please enter a valid public key";
  } else {
    return "Submit";
  }
};

type OptOut = Omit<
  ComponentProps<typeof ModalDialog>,
  "title" | "children" | "closeButtonText" | "closeDisabled" | "description"
> & {
  api: States[ApiStateType.Loaded];
  self: PublisherProps["publisher"];
};

const OptOut = ({ api, self, ...props }: OptOut) => {
  return hasAnyPositions(self) ? (
    <ModalDialog closeButtonText="Ok" title="You must unstake first" {...props}>
      <div className="flex max-w-prose flex-col gap-4">
        <p className="font-semibold">
          You cannot opt out of rewards while self-staked.
        </p>
        <p className="opacity-90">
          Please close all self-staking positions, wait the cooldown period (if
          applicable), and try again once your self-stake is fully closed.
        </p>
      </div>
    </ModalDialog>
  ) : (
    <ModalDialog title="Are you sure?" {...props}>
      {({ close }) => (
        <OptOutModalContents api={api} close={close} self={self} />
      )}
    </ModalDialog>
  );
};

type OptOutModalContentsProps = {
  api: States[ApiStateType.Loaded];
  self: PublisherProps["publisher"];
  close: () => void;
};

const OptOutModalContents = ({
  api,
  self,
  close,
}: OptOutModalContentsProps) => {
  const { state, execute } = useAsync(() =>
    api.optPublisherOut(self.publicKey),
  );

  const toast = useToast();

  const doOptOut = useCallback(() => {
    execute()
      .then(() => {
        toast.success("You have opted out of rewards");
      })
      .catch(() => {
        /* no-op since this is already handled in the UI using `state` and is logged in useAsync */
      });
  }, [execute, toast]);

  return (
    <>
      <div className="flex max-w-prose flex-col gap-4">
        <p className="font-semibold">
          Are you sure you want to opt out of rewards?
        </p>
        <p className="opacity-90">
          Opting out of rewards will prevent you from earning the publisher
          yield rate and delegation fees from your delegators. You will still be
          able to participate in OIS after opting out of rewards.
        </p>
      </div>
      {state.type === UseAsyncStateType.Error && (
        <div className="mt-4 max-w-prose">
          <ErrorMessage error={state.error} />
        </div>
      )}
      <div className="mt-14 flex flex-col gap-8 sm:flex-row sm:justify-between">
        <Button className="w-full sm:w-auto" onPress={close} size="noshrink">
          No, I want rewards!
        </Button>
        <Button
          className="w-full sm:w-auto"
          isDisabled={state.type === UseAsyncStateType.Complete}
          isLoading={state.type === UseAsyncStateType.Running}
          onPress={doOptOut}
          size="noshrink"
          variant="secondary"
        >
          Yes, opt me out
        </Button>
      </div>
    </>
  );
};

type PublisherListProps = {
  api: States[ApiStateType.Loaded] | States[ApiStateType.LoadedNoStakeAccount];
  currentEpoch: bigint;
  title: string;
  availableToStake: bigint;
  totalStaked: bigint;
  publishers: PublisherProps["publisher"][];
  yieldRate: bigint;
};

const PublisherList = ({
  api,
  currentEpoch,
  title,
  availableToStake,
  publishers,
  totalStaked,
  yieldRate,
}: PublisherListProps) => {
  const [pageSize, setPageSize] = useState<(typeof PageSize)[number]>(
    PageSize[2],
  );
  const scrollTarget = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(SortOption.SelfStakeDescending);
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const [currentPage, setPage] = useState(1);
  const collator = useCollator();
  const filteredSortedPublishers = useMemo(
    () =>
      publishers
        .filter(
          (publisher) =>
            filter.contains(publisher.publicKey.toBase58(), search) ||
            (publisher.identity !== undefined &&
              filter.contains(publisher.identity.name, search)),
        )
        .sort((a, b) => {
          return compare(collator, a, b, yieldRate, sort);
        }),
    [publishers, search, sort, filter, yieldRate, collator],
  );

  const paginatedPublishers = useMemo(
    () =>
      filteredSortedPublishers.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize,
      ),
    [filteredSortedPublishers, currentPage, pageSize],
  );

  const updatePage = useCallback<typeof setPage>(
    (newPage) => {
      if (scrollTarget.current) {
        scrollTarget.current.scrollIntoView({ behavior: "smooth" });
      }
      setPage(newPage);
    },
    [setPage],
  );

  const updateSearch = useCallback<typeof setSearch>(
    (newSearch) => {
      setSearch(newSearch);
      updatePage(1);
    },
    [setSearch, updatePage],
  );

  const updateSort = useCallback<typeof setSort>(
    (newSort) => {
      setSort(newSort);
      updatePage(1);
    },
    [setSort, updatePage],
  );

  const updatePageSize = useCallback<typeof setPageSize>(
    (newPageSize) => {
      setPageSize(newPageSize);
      updatePage(1);
    },
    [setPageSize, updatePage],
  );

  const numPages = useMemo(
    () => Math.ceil(filteredSortedPublishers.length / pageSize),
    [filteredSortedPublishers, pageSize],
  );

  return (
    <div className="relative w-full overflow-x-auto">
      <div ref={scrollTarget} />
      <div className="sticky left-0 mb-4 flex flex-col gap-4 px-4 sm:px-10 sm:pb-4 sm:pt-6 md:flex-row md:justify-between md:gap-12 lg:items-start">
        <h3 className="flex-none text-2xl font-light md:mt-1">{title}</h3>

        <div className="flex flex-none grow flex-col items-end gap-2 xl:flex-row-reverse xl:items-center xl:justify-start xl:gap-8 2xl:gap-16">
          <SearchField
            aria-label="Search"
            className="group relative w-full md:max-w-96 xl:max-w-64 2xl:max-w-96"
            onChange={updateSearch}
            value={search}
          >
            <Input
              className="group-focused:ring-0 group-focused:border-pythpurple-400 group-focused:outline-none w-full truncate border border-pythpurple-600 bg-pythpurple-600/10 py-2 pl-10 pr-8 focus:border-pythpurple-400 focus:outline-none focus:ring-0 focus-visible:border-pythpurple-400 focus-visible:outline-none focus-visible:ring-0 search-cancel:appearance-none search-decoration:appearance-none"
              placeholder="Search"
            />
            <div className="absolute inset-y-0 left-4 grid place-content-center">
              <MagnifyingGlassIcon className="size-4 text-pythpurple-400" />
            </div>
            <div className="absolute inset-y-0 right-2 grid place-content-center">
              <BaseButton className="p-2 group-empty:hidden">
                <XMarkIcon className="size-4" />
              </BaseButton>
            </div>
          </SearchField>
          <Select
            className="2xl:hidden"
            label="Sort by"
            onSelectionChange={updateSort}
            options={[
              SortOption.PublisherNameDescending,
              SortOption.PublisherNameAscending,
              SortOption.RemainingPoolDescending,
              SortOption.RemainingPoolAscending,
              SortOption.ApyDescending,
              SortOption.ApyAscending,
              SortOption.SelfStakeDescending,
              SortOption.SelfStakeAscending,
              SortOption.NumberOfFeedsDescending,
              SortOption.NumberOfFeedsAscending,
              SortOption.QualityRankingDescending,
              SortOption.QualityRankingAscending,
            ]}
            selectedKey={sort}
            show={getSortName}
          />
        </div>
      </div>

      {filteredSortedPublishers.length > 0 ? (
        <>
          <ul className="bg-white/5 2xl:hidden">
            {paginatedPublishers.map((publisher) => (
              <li key={publisher.publicKey.toBase58()}>
                <Publisher
                  api={api}
                  availableToStake={availableToStake}
                  compact
                  currentEpoch={currentEpoch}
                  publisher={publisher}
                  totalStaked={totalStaked}
                  yieldRate={yieldRate}
                />
              </li>
            ))}
          </ul>
          <table className="hidden min-w-full text-sm 2xl:table">
            <thead className="bg-pythpurple-100/30 font-light">
              <tr>
                <SortablePublisherTableHeader
                  alignment="left"
                  asc={SortOption.PublisherNameAscending}
                  className="pl-4 sm:pl-10"
                  desc={SortOption.PublisherNameDescending}
                  setSort={updateSort}
                  sort={sort}
                >
                  Publisher
                </SortablePublisherTableHeader>
                <SortablePublisherTableHeader
                  asc={SortOption.SelfStakeAscending}
                  desc={SortOption.SelfStakeDescending}
                  setSort={updateSort}
                  sort={sort}
                >
                  {"Publisher's stake"}
                </SortablePublisherTableHeader>
                <SortablePublisherTableHeader
                  asc={SortOption.RemainingPoolAscending}
                  desc={SortOption.RemainingPoolDescending}
                  setSort={updateSort}
                  sort={sort}
                >
                  Pool
                </SortablePublisherTableHeader>
                <SortablePublisherTableHeader
                  asc={SortOption.ApyAscending}
                  desc={SortOption.ApyDescending}
                  setSort={updateSort}
                  sort={sort}
                >
                  Estimated next APY
                </SortablePublisherTableHeader>
                <PublisherTableHeader>Historical APY</PublisherTableHeader>
                <SortablePublisherTableHeader
                  asc={SortOption.NumberOfFeedsAscending}
                  desc={SortOption.NumberOfFeedsDescending}
                  setSort={updateSort}
                  sort={sort}
                >
                  Number of feeds
                </SortablePublisherTableHeader>
                <SortablePublisherTableHeader
                  asc={SortOption.QualityRankingAscending}
                  desc={SortOption.QualityRankingDescending}
                  setSort={updateSort}
                  sort={sort}
                >
                  Quality ranking
                </SortablePublisherTableHeader>
              </tr>
            </thead>

            <tbody className="bg-white/5">
              {paginatedPublishers.map((publisher) => (
                <Publisher
                  api={api}
                  availableToStake={availableToStake}
                  currentEpoch={currentEpoch}
                  key={publisher.publicKey.toBase58()}
                  publisher={publisher}
                  totalStaked={totalStaked}
                  yieldRate={yieldRate}
                />
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="my-20 text-center text-lg opacity-80">
          No results match your query
        </p>
      )}

      {numPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-4 border-t border-neutral-600/50 p-4 sm:flex-row">
          <Select
            label="Page size"
            onSelectionChange={updatePageSize}
            options={PageSize}
            selectedKey={pageSize}
          />
          <Paginator
            currentPage={currentPage}
            numPages={numPages}
            onPageChange={updatePage}
          />
        </div>
      )}
    </div>
  );
};

type PaginatorProps = {
  currentPage: number;
  numPages: number;
  onPageChange: (newPage: number) => void;
};

const Paginator = ({ currentPage, numPages, onPageChange }: PaginatorProps) => {
  const { first, count } = getPageRange(currentPage, numPages);
  const pages = Array.from({ length: count })
    .fill(undefined)
    .map((_, i) => i + first);

  return (
    <ul className="sticky inset-x-0 flex flex-row gap-2">
      {currentPage > 1 && (
        <li>
          <Button
            className="size-8"
            onPress={() => {
              onPageChange(1);
            }}
            size="nopad"
            variant="secondary"
          >
            <ChevronDoubleLeftIcon className="size-4" />
          </Button>
        </li>
      )}
      {pages.map((page) =>
        page === currentPage ? (
          <li
            className="grid size-8 place-content-center border border-pythpurple-600 bg-pythpurple-600"
            key={page}
          >
            {page}
          </li>
        ) : (
          <li key={page}>
            <Button
              className="size-8"
              key={page}
              onPress={() => {
                onPageChange(page);
              }}
              size="nopad"
              variant="secondary"
            >
              {page}
            </Button>
          </li>
        ),
      )}
      {currentPage < numPages && (
        <li>
          <Button
            className="size-8"
            onPress={() => {
              onPageChange(numPages);
            }}
            size="nopad"
            variant="secondary"
          >
            <ChevronDoubleRightIcon className="size-4" />
          </Button>
        </li>
      )}
    </ul>
  );
};

const getPageRange = (
  page: number,
  numPages: number,
): { first: number; count: number } => {
  const first =
    page <= 3 || numPages <= 5
      ? 1
      : page - 2 - Math.max(2 - (numPages - page), 0);
  return { count: Math.min(numPages - first + 1, 5), first };
};

const compare = (
  collator: Intl.Collator,
  a: PublisherProps["publisher"],
  b: PublisherProps["publisher"],
  yieldRate: bigint,
  sort: SortOption,
): number => {
  switch (sort) {
    case SortOption.PublisherNameAscending:
    case SortOption.PublisherNameDescending: {
      // No need for a fallback sort since each publisher has a unique value.
      return compareName(
        collator,
        a,
        b,
        sort === SortOption.PublisherNameAscending,
      );
    }
    case SortOption.ApyAscending:
    case SortOption.ApyDescending: {
      const ascending = sort === SortOption.ApyAscending;
      return compareInOrder([
        () => compareApy(a, b, yieldRate, ascending),
        () => compareSelfStake(a, b, ascending),
        () => comparePoolCapacity(a, b, ascending),
        () => compareName(collator, a, b, ascending),
      ]);
    }
    case SortOption.NumberOfFeedsAscending:
    case SortOption.NumberOfFeedsDescending: {
      const ascending = sort === SortOption.NumberOfFeedsAscending;
      return compareInOrder([
        () => (ascending ? -1 : 1) * Number(b.numFeeds - a.numFeeds),
        () => compareSelfStake(a, b, ascending),
        () => comparePoolCapacity(a, b, ascending),
        () => compareApy(a, b, yieldRate, ascending),
        () => compareName(collator, a, b, ascending),
      ]);
    }
    case SortOption.RemainingPoolAscending:
    case SortOption.RemainingPoolDescending: {
      const ascending = sort === SortOption.RemainingPoolAscending;
      return compareInOrder([
        () => comparePoolCapacity(a, b, ascending),
        () => compareSelfStake(a, b, ascending),
        () => compareApy(a, b, yieldRate, ascending),
        () => compareName(collator, a, b, ascending),
      ]);
    }
    case SortOption.QualityRankingDescending:
    case SortOption.QualityRankingAscending: {
      // No need for a fallback sort since each publisher has a unique value.
      return compareQualityRanking(
        a,
        b,
        sort === SortOption.QualityRankingAscending,
      );
    }
    case SortOption.SelfStakeAscending:
    case SortOption.SelfStakeDescending: {
      const ascending = sort === SortOption.SelfStakeAscending;
      return compareInOrder([
        () => compareSelfStake(a, b, ascending),
        () => comparePoolCapacity(a, b, ascending),
        () => compareApy(a, b, yieldRate, ascending),
        () => compareName(collator, a, b, ascending),
      ]);
    }
  }
};

const compareInOrder = (comparisons: (() => number)[]): number => {
  for (const compare of comparisons) {
    const value = compare();
    if (value !== 0) {
      return value;
    }
  }
  return 0;
};

const compareName = (
  collator: Intl.Collator,
  a: PublisherProps["publisher"],
  b: PublisherProps["publisher"],
  reverse?: boolean,
) =>
  (reverse ? -1 : 1) *
  collator.compare(
    a.identity?.name ?? a.publicKey.toBase58(),
    b.identity?.name ?? b.publicKey.toBase58(),
  );

const compareApy = (
  a: PublisherProps["publisher"],
  b: PublisherProps["publisher"],
  yieldRate: bigint,
  reverse?: boolean,
) =>
  (reverse ? -1 : 1) *
  (calculateApy({
    delegationFee: b.delegationFee,
    isSelf: false,
    poolCapacity: b.poolCapacity,
    poolUtilization: b.poolUtilization + b.poolUtilizationDelta,
    selfStake: b.selfStake + b.selfStakeDelta,
    yieldRate,
  }) -
    calculateApy({
      delegationFee: a.delegationFee,
      isSelf: false,
      poolCapacity: a.poolCapacity,
      poolUtilization: a.poolUtilization + a.poolUtilizationDelta,
      selfStake: a.selfStake + a.selfStakeDelta,
      yieldRate,
    }));

const comparePoolCapacity = (
  a: PublisherProps["publisher"],
  b: PublisherProps["publisher"],
  reverse?: boolean,
) => {
  if (a.poolCapacity === 0n && b.poolCapacity === 0n) {
    return 0;
  } else if (a.poolCapacity === 0n) {
    return 1;
  } else if (b.poolCapacity === 0n) {
    return -1;
  } else {
    const remainingPoolA =
      a.poolCapacity - a.poolUtilization - a.poolUtilizationDelta;
    const remainingPoolB =
      b.poolCapacity - b.poolUtilization - b.poolUtilizationDelta;
    if (remainingPoolA <= 0n && remainingPoolB <= 0n) {
      return 0;
    } else if (remainingPoolA <= 0n && remainingPoolB > 0n) {
      return 1;
    } else if (remainingPoolB <= 0n && remainingPoolA > 0n) {
      return -1;
    } else {
      return (reverse ? -1 : 1) * Number(remainingPoolB - remainingPoolA);
    }
  }
};

const compareQualityRanking = (
  a: PublisherProps["publisher"],
  b: PublisherProps["publisher"],
  reverse?: boolean,
) => {
  if (a.qualityRanking === 0 && b.qualityRanking === 0) {
    return 0;
  } else if (a.qualityRanking === 0) {
    return 1;
  } else if (b.qualityRanking === 0) {
    return -1;
  } else {
    return (reverse ? -1 : 1) * Number(a.qualityRanking - b.qualityRanking);
  }
};

const compareSelfStake = (
  a: PublisherProps["publisher"],
  b: PublisherProps["publisher"],
  reverse?: boolean,
) =>
  (reverse ? -1 : 1) *
  Number(b.selfStake + b.selfStakeDelta - (a.selfStake + a.selfStakeDelta));

type SortablePublisherTableHeaderProps = Omit<
  ComponentProps<typeof BaseButton>,
  "children"
> & {
  children: string;
  asc: SortOption;
  desc: SortOption;
  sort: SortOption;
  setSort: Dispatch<SetStateAction<SortOption>>;
  alignment?: "left" | "right";
};

const SortablePublisherTableHeader = ({
  asc,
  desc,
  sort,
  setSort,
  children,
  className,
  alignment,
  ...props
}: SortablePublisherTableHeaderProps) => {
  const updateSort = useCallback(() => {
    setSort((cur) => (cur === desc ? asc : desc));
  }, [setSort, asc, desc]);

  return (
    <th>
      <PublisherTableHeader
        as={BaseButton}
        className={clsx(
          "group size-full data-[sorted]:bg-black/20 data-[alignment=center]:data-[sorted]:px-2.5 data-[alignment=left]:text-left data-[alignment=right]:text-right focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400",
          className,
        )}
        onPress={updateSort}
        {...((sort === asc || sort === desc) && { "data-sorted": true })}
        {...(sort === desc && { "data-descending": true })}
        data-alignment={alignment ?? "center"}
        {...props}
      >
        <span className="align-middle">{children}</span>
        <ChevronUpIcon className="ml-2 hidden size-3 transition-transform group-data-[sorted]:inline group-data-[descending]:rotate-180" />
      </PublisherTableHeader>
    </th>
  );
};

const PublisherTableHeader = Styled(
  "th",
  "py-2 font-normal px-5 h-full whitespace-nowrap",
);

type PublisherProps = {
  api: States[ApiStateType.Loaded] | States[ApiStateType.LoadedNoStakeAccount];
  currentEpoch: bigint;
  availableToStake: bigint;
  totalStaked: bigint;
  isSelf?: boolean | undefined;
  publisher: {
    identity: ReturnType<typeof lookup>;
    publicKey: PublicKey;
    stakeAccount: PublicKey | undefined;
    selfStake: bigint;
    selfStakeDelta: bigint;
    poolCapacity: bigint;
    poolUtilization: bigint;
    poolUtilizationDelta: bigint;
    numFeeds: number;
    qualityRanking: number;
    delegationFee: bigint;
    apyHistory: { date: Date; apy: number; selfApy: number }[];
    positions?:
      | {
          warmup?: bigint | undefined;
          staked?: bigint | undefined;
          cooldown?: bigint | undefined;
          cooldown2?: bigint | undefined;
        }
      | undefined;
  };
  yieldRate: bigint;
  compact?: boolean | undefined;
};

const Publisher = ({
  api,
  currentEpoch,
  publisher,
  totalStaked,
  isSelf,
  yieldRate,
  compact,
}: PublisherProps) => {
  const warmup = useMemo(
    () =>
      publisher.positions?.warmup !== undefined &&
      publisher.positions.warmup > 0n
        ? publisher.positions.warmup
        : undefined,
    [publisher.positions?.warmup],
  );
  const staked = useMemo(
    () =>
      publisher.positions?.staked !== undefined &&
      publisher.positions.staked > 0n
        ? publisher.positions.staked
        : undefined,
    [publisher.positions?.staked],
  );

  const cancelWarmup = useTransferActionForPublisher(
    api.type === ApiStateType.Loaded
      ? api.cancelWarmupIntegrityStaking
      : undefined,
    publisher.publicKey,
  );
  const unstake = useTransferActionForPublisher(
    api.type === ApiStateType.Loaded ? api.unstakeIntegrityStaking : undefined,
    publisher.publicKey,
  );

  const estimatedNextApy = useMemo(
    () =>
      calculateApy({
        delegationFee: publisher.delegationFee,
        isSelf: isSelf ?? false,
        poolCapacity: publisher.poolCapacity,
        poolUtilization:
          publisher.poolUtilization + publisher.poolUtilizationDelta,
        selfStake: publisher.selfStake + publisher.selfStakeDelta,
        yieldRate,
      }).toFixed(2),
    [
      isSelf,
      publisher.selfStake,
      publisher.selfStakeDelta,
      publisher.poolCapacity,
      publisher.poolUtilization,
      publisher.poolUtilizationDelta,
      publisher.delegationFee,
      yieldRate,
    ],
  );

  return compact ? (
    <div className="border-t border-neutral-600/50 p-4 sm:px-10 md:pt-8">
      {!isSelf && (
        <div className="flex flex-row items-center justify-between">
          <PublisherIdentity
            className="font-semibold"
            fullClassName="hidden md:inline"
            truncatedClassName="md:hidden"
            withNameClassName="flex flex-col items-start"
          >
            {publisher}
          </PublisherIdentity>
        </div>
      )}
      <div
        className={clsx(
          "gap-8",
          isSelf
            ? "flex flex-row-reverse items-center justify-between"
            : "xs:flex xs:flex-row-reverse xs:items-center xs:justify-between",
        )}
      >
        {!isSelf && (
          <div className="flex grow flex-col gap-2 xs:items-end">
            <UtilizationMeter
              className="mx-auto my-4 w-full grow xs:mx-0 sm:w-auto sm:flex-none"
              publisher={publisher}
            />
          </div>
        )}
        <dl
          className={clsx(
            "flex-none text-xs",
            isSelf
              ? "lg:flex lg:flex-row lg:gap-6"
              : "md:grid md:grid-cols-2 lg:gap-x-10 xl:flex xl:flex-row xl:gap-8",
          )}
        >
          {!isSelf && (
            <div className="flex flex-row items-center gap-2">
              <dt className="font-semibold">{"Publisher's Stake:"}</dt>
              <dd>
                <Tokens>
                  {publisher.selfStake + publisher.selfStakeDelta}
                </Tokens>
              </dd>
            </div>
          )}
          <div className="flex flex-row items-center gap-2">
            <dt className="font-semibold">Estimated Next APY:</dt>
            <dd>{estimatedNextApy}%</dd>
          </div>
          <div className="flex flex-row items-center gap-2">
            <dt className="font-semibold">Number of feeds:</dt>
            <dd>{publisher.numFeeds}</dd>
          </div>
          <div className="flex flex-row items-center gap-2">
            <dt className="font-semibold">Quality ranking:</dt>
            <dd>
              {publisher.qualityRanking === 0 ? "-" : publisher.qualityRanking}
            </dd>
          </div>
        </dl>
      </div>
      {isSelf && (
        <UtilizationMeter
          className="mx-auto my-4 w-full grow xs:mx-0"
          publisher={publisher}
        />
      )}
      {(warmup !== undefined || staked !== undefined) && (
        <YourPositionsTable
          cancelWarmup={cancelWarmup}
          currentEpoch={currentEpoch}
          publisher={publisher}
          staked={staked}
          totalStaked={totalStaked}
          unstake={unstake}
          warmup={warmup}
        />
      )}
    </div>
  ) : (
    <>
      <tr className="border-t border-neutral-600/50 first:border-0">
        {!isSelf && (
          <>
            <PublisherTableCell className="truncate py-4 pl-4 font-medium sm:pl-10">
              <PublisherIdentity
                fullClassName="hidden 3xl:inline"
                truncatedClassName="3xl:hidden"
                withNameClassName="flex flex-col items-start"
              >
                {publisher}
              </PublisherIdentity>
            </PublisherTableCell>
            <PublisherTableCell className="text-center">
              <Tokens>{publisher.selfStake + publisher.selfStakeDelta}</Tokens>
            </PublisherTableCell>
          </>
        )}
        <PublisherTableCell className="text-center">
          <UtilizationMeter publisher={publisher} />
        </PublisherTableCell>
        <PublisherTableCell className="text-center">
          {estimatedNextApy}%
        </PublisherTableCell>
        <PublisherTableCell>
          <div className="mx-auto h-14 w-28">
            <SparkChart
              data={publisher.apyHistory.map(({ date, apy, selfApy }) => ({
                date,
                value: isSelf ? selfApy : apy,
              }))}
            />
          </div>
        </PublisherTableCell>
        <PublisherTableCell className="text-center">
          {publisher.numFeeds}
        </PublisherTableCell>
        <PublisherTableCell className="text-center">
          {publisher.qualityRanking === 0 ? "-" : publisher.qualityRanking}
        </PublisherTableCell>
      </tr>
      {(warmup !== undefined || staked !== undefined) && (
        <tr>
          <td className="border-separate border-spacing-8" colSpan={7}>
            <YourPositionsTable
              cancelWarmup={cancelWarmup}
              currentEpoch={currentEpoch}
              publisher={publisher}
              staked={staked}
              totalStaked={totalStaked}
              unstake={unstake}
              warmup={warmup}
            />
          </td>
        </tr>
      )}
    </>
  );
};

type UtilizationMeterProps = Omit<ComponentProps<typeof Meter>, "children"> & {
  publisher: PublisherProps["publisher"];
};

const UtilizationMeter = ({ publisher, ...props }: UtilizationMeterProps) => {
  const utilizationPercent = useMemo(
    () =>
      publisher.poolCapacity > 0n
        ? Number(
            (100n *
              (publisher.poolUtilization + publisher.poolUtilizationDelta)) /
              publisher.poolCapacity,
          )
        : Number.NaN,
    [
      publisher.poolUtilization,
      publisher.poolUtilizationDelta,
      publisher.poolCapacity,
    ],
  );

  return (
    <Meter value={utilizationPercent} {...props}>
      {({ percentage }) => (
        <>
          <div className="relative mx-auto grid h-5 w-full place-content-center border border-black bg-pythpurple-600/20 sm:w-52">
            <div
              className={clsx(
                "absolute inset-0 max-w-full",
                percentage < 100 ? "bg-pythpurple-400" : "bg-red-800",
              )}
              style={{
                width: `${percentage.toString()}%`,
              }}
            />
            <div
              className={clsx("isolate text-sm font-medium", {
                "mix-blend-difference": percentage < 100,
              })}
            >
              {Number.isNaN(utilizationPercent)
                ? "Inactive Pool"
                : `${utilizationPercent.toString()}%`}
            </div>
          </div>
          <Label className="mt-1 flex flex-row items-center justify-center gap-1 text-sm">
            <span>
              <Tokens>
                {publisher.poolUtilization + publisher.poolUtilizationDelta}
              </Tokens>
            </span>
            <span>/</span>
            <span>
              <Tokens>{publisher.poolCapacity}</Tokens>
            </span>
          </Label>
        </>
      )}
    </Meter>
  );
};

type YourPositionsTableProps = {
  publisher: PublisherProps["publisher"];
  warmup: bigint | undefined;
  cancelWarmup: ((amount: bigint) => Promise<void>) | undefined;
  staked: bigint | undefined;
  totalStaked: bigint;
  unstake: ((amount: bigint) => Promise<void>) | undefined;
  currentEpoch: bigint;
};

const YourPositionsTable = ({
  warmup,
  cancelWarmup,
  staked,
  totalStaked,
  unstake,
  currentEpoch,
  publisher,
}: YourPositionsTableProps) => (
  <div className="mx-auto mb-0 mt-4 border border-neutral-600/50 bg-pythpurple-800 p-4 text-xs sm:mb-4 sm:px-8 sm:py-6 md:mb-8 md:w-[25rem] lg:w-[35rem]">
    <table className="w-full text-sm md:text-base">
      <caption className="mb-2 text-left font-light md:text-lg">
        Your Positions
      </caption>
      <tbody>
        {warmup !== undefined && (
          <tr>
            <td className="opacity-80">Warmup</td>
            <td className="px-4">
              <Tokens>{warmup}</Tokens>
            </td>
            <td
              className={clsx("text-right", {
                "pb-2": staked !== undefined,
              })}
            >
              <TransferButton
                actionDescription={
                  <>
                    <span className="mr-[0.5em]">
                      Cancel tokens that are in warmup for staking to
                    </span>
                    <PublisherIdentity className="font-semibold">
                      {publisher}
                    </PublisherIdentity>
                  </>
                }
                actionName="Cancel"
                className="w-28"
                max={warmup}
                size="small"
                submitButtonText="Cancel Warmup"
                successMessage="Your tokens are no longer in warmup for staking"
                title="Cancel Warmup"
                transfer={cancelWarmup}
                variant="secondary"
              />
            </td>
          </tr>
        )}
        {staked !== undefined && (
          <tr>
            <td className="opacity-80">Staked</td>
            <td className="px-4">
              <div className="flex items-center gap-2">
                <Tokens>{staked}</Tokens>
                <div className="hidden text-xs opacity-60 xs:block">
                  ({Number((100n * staked) / totalStaked)}% of your staked
                  tokens)
                </div>
              </div>
            </td>
            <td className="py-0.5 text-right">
              <TransferButton
                actionDescription={
                  <>
                    <span className="mr-[0.5em]">Unstake tokens from</span>
                    <PublisherIdentity className="font-semibold">
                      {publisher}
                    </PublisherIdentity>
                  </>
                }
                actionName="Unstake"
                className="md:w-28"
                max={staked}
                size="small"
                successMessage="Your tokens are now cooling down and will be available to withdraw at the end of the next epoch"
                transfer={unstake}
                variant="secondary"
              >
                <StakingTimeline cooldownOnly currentEpoch={currentEpoch} />
              </TransferButton>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const PublisherTableCell = Styled("td", "py-4 px-5 whitespace-nowrap");

type PublisherIdentityProps = PublisherKeyProps & {
  withNameClassName?: string | undefined;
};

const PublisherIdentity = ({
  className,
  withNameClassName,
  ...props
}: PublisherIdentityProps) =>
  props.children.identity ? (
    <span className={clsx(className, withNameClassName)}>
      <span>
        {createElement(props.children.identity.icon.monochrome, {
          className: "mr-2 inline-block h-[20px] align-sub",
        })}
        <span className="mr-[0.5em]">{props.children.identity.name}</span>
      </span>
      <PublisherKey className="text-sm opacity-50" {...props} />
    </span>
  ) : (
    <PublisherKey className={className} {...props} />
  );

type PublisherKeyProps = {
  className?: string | undefined;
  children: PublisherProps["publisher"];
  fullClassName?: string;
  truncatedClassName?: string;
};

const PublisherKey = ({
  children,
  fullClassName,
  truncatedClassName,
  className,
}: PublisherKeyProps) => (
  <CopyButton
    text={children.publicKey.toBase58()}
    {...(className && { className })}
  >
    {fullClassName && (
      <code className={fullClassName}>{children.publicKey.toBase58()}</code>
    )}
    <TruncatedKey className={truncatedClassName}>
      {children.publicKey}
    </TruncatedKey>
  </CopyButton>
);

const useTransferActionForPublisher = (
  action: ((publisher: PublicKey, amount: bigint) => Promise<void>) | undefined,
  publisher: PublicKey,
) =>
  useMemo(
    () =>
      action === undefined
        ? undefined
        : (amount: bigint) => action(publisher, amount),
    [action, publisher],
  );

const hasAnyNonCooldownPositions = ({
  positions,
}: PublisherProps["publisher"]) =>
  positions !== undefined &&
  [positions.warmup, positions.staked].some(
    (value) => value !== undefined && value > 0n,
  );

const hasAnyPositions = ({ positions }: PublisherProps["publisher"]) =>
  positions !== undefined &&
  [
    positions.warmup,
    positions.staked,
    positions.cooldown,
    positions.cooldown2,
  ].some((value) => value !== undefined && value > 0n);

enum SortOption {
  PublisherNameDescending,
  PublisherNameAscending,
  RemainingPoolDescending,
  RemainingPoolAscending,
  ApyDescending,
  ApyAscending,
  SelfStakeDescending,
  SelfStakeAscending,
  NumberOfFeedsDescending,
  NumberOfFeedsAscending,
  QualityRankingDescending,
  QualityRankingAscending,
}

const getSortName = (sortOption: SortOption) => {
  switch (sortOption) {
    case SortOption.PublisherNameDescending: {
      return "Publisher Name (A-Z)";
    }
    case SortOption.PublisherNameAscending: {
      return "Publisher Name (Z-A)";
    }
    case SortOption.RemainingPoolDescending: {
      return "Most remaining pool";
    }
    case SortOption.RemainingPoolAscending: {
      return "Least remaining pool";
    }
    case SortOption.ApyDescending: {
      return "Highest estimated next APY";
    }
    case SortOption.ApyAscending: {
      return "Lowest estimated next APY";
    }
    case SortOption.SelfStakeDescending: {
      return "Highest publisher's stake";
    }
    case SortOption.SelfStakeAscending: {
      return "Lowest publisher's stake";
    }
    case SortOption.NumberOfFeedsDescending: {
      return "Most feeds";
    }
    case SortOption.NumberOfFeedsAscending: {
      return "Least feeds";
    }
    case SortOption.QualityRankingDescending: {
      return "Best quality ranking";
    }
    case SortOption.QualityRankingAscending: {
      return "Worst quality ranking";
    }
  }
};

const PageSize = [10, 20, 30, 40, 50] as const;

class InvalidKeyError extends Error {
  constructor() {
    super("Invalid public key");
  }
}
