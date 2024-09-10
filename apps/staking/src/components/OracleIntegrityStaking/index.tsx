import {
  ChevronUpIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { calculateApy, type PythStakingClient } from "@pythnetwork/staking-sdk";
import { PublicKey } from "@solana/web3.js";
import clsx from "clsx";
import {
  useMemo,
  useCallback,
  useState,
  type ComponentProps,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useFilter } from "react-aria";
import {
  SearchField,
  Input,
  Button as BaseButton,
  Meter,
  Label,
} from "react-aria-components";

import {
  delegateIntegrityStaking,
  cancelWarmupIntegrityStaking,
  unstakeIntegrityStaking,
} from "../../api";
import { Button } from "../Button";
import { ProgramSection } from "../ProgramSection";
import { SparkChart } from "../SparkChart";
import { StakingTimeline } from "../StakingTimeline";
import { Styled } from "../Styled";
import { Tokens } from "../Tokens";
import { AmountType, TransferButton } from "../TransferButton";

const PAGE_SIZE = 10;

type Props = {
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
    () => publishers.find((publisher) => publisher.isSelf),
    [publishers],
  );

  const otherPublishers = useMemo(
    () =>
      publishers.filter(
        (publisher) =>
          !publisher.isSelf &&
          (publisher.poolCapacity > 0n || hasAnyPositions(publisher)),
      ),
    [publishers],
  );

  return (
    <ProgramSection
      name="Oracle Integrity Staking (OIS)"
      description="Protect DeFi"
      className="pb-0 sm:pb-0"
      available={availableToStake}
      warmup={warmup}
      staked={staked}
      cooldown={cooldown}
      cooldown2={cooldown2}
      {...(locked > 0n && {
        availableToStakeDetails: (
          <div className="mt-2 text-xs text-red-600">
            <Tokens>{locked}</Tokens> are locked and cannot be staked in OIS
          </div>
        ),
      })}
    >
      {self && (
        <div className="relative -mx-4 mt-6 overflow-hidden border-t border-neutral-600/50 pt-6 sm:-mx-10 sm:mt-10">
          <div className="relative w-full overflow-x-auto">
            <h3 className="sticky left-0 mb-4 pl-4 text-2xl font-light sm:pb-4 sm:pl-10 sm:pt-6">
              You ({self.name ?? self.publicKey.toBase58()})
            </h3>

            <table className="mx-auto border border-neutral-600/50 text-sm">
              <thead className="bg-pythpurple-400/30 font-light">
                <tr>
                  <PublisherTableHeader>Pool</PublisherTableHeader>
                  <PublisherTableHeader>Last epoch APY</PublisherTableHeader>
                  <PublisherTableHeader>Historical APY</PublisherTableHeader>
                  <PublisherTableHeader>Number of feeds</PublisherTableHeader>
                  <PublisherTableHeader>Quality ranking</PublisherTableHeader>
                  {availableToStake > 0n && <PublisherTableHeader />}
                </tr>
              </thead>
              <tbody className="bg-pythpurple-400/10">
                <Publisher
                  isSelf
                  availableToStake={availableToStake}
                  publisher={self}
                  totalStaked={staked}
                  yieldRate={yieldRate}
                />
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div
        className={clsx(
          "relative -mx-4 overflow-hidden border-t border-neutral-600/50 pt-6 sm:-mx-10 lg:mt-10",
          { "mt-6": self === undefined },
        )}
      >
        <PublisherList
          title={self ? "Other Publishers" : "Publishers"}
          availableToStake={availableToStake}
          publishers={otherPublishers}
          totalStaked={staked}
          yieldRate={yieldRate}
        />
      </div>
    </ProgramSection>
  );
};

type PublisherListProps = {
  title: string;
  availableToStake: bigint;
  totalStaked: bigint;
  publishers: PublisherProps["publisher"][];
  yieldRate: bigint;
};

const PublisherList = ({
  title,
  availableToStake,
  publishers,
  totalStaked,
  yieldRate,
}: PublisherListProps) => {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({
    field: SortField.PoolUtilization,
    descending: false,
  });
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const [currentPage, setPage] = useState(0);
  const filteredSortedPublishers = useMemo(() => {
    const sorted = publishers
      .filter(
        (publisher) =>
          filter.contains(publisher.publicKey.toBase58(), search) ||
          (publisher.name !== undefined &&
            filter.contains(publisher.name, search)),
      )
      .sort((a, b) => {
        switch (sort.field) {
          case SortField.PublisherName: {
            return (a.name ?? a.publicKey.toBase58()).localeCompare(
              b.name ?? b.publicKey.toBase58(),
            );
          }
          case SortField.APY: {
            return (
              calculateApy({
                isSelf: false,
                selfStake: a.selfStake,
                poolCapacity: a.poolCapacity,
                poolUtilization: a.poolUtilization,
                yieldRate,
              }) -
              calculateApy({
                isSelf: false,
                selfStake: b.selfStake,
                poolCapacity: b.poolCapacity,
                poolUtilization: b.poolUtilization,
                yieldRate,
              })
            );
          }
          case SortField.NumberOfFeeds: {
            return Number(a.numFeeds - b.numFeeds);
          }
          case SortField.PoolUtilization: {
            return Number(
              a.poolUtilization * b.poolCapacity -
                b.poolUtilization * a.poolCapacity,
            );
          }
          case SortField.QualityRanking: {
            return Number(a.qualityRanking - b.qualityRanking);
          }
          case SortField.SelfStake: {
            return Number(a.selfStake - b.selfStake);
          }
        }
      });
    return sort.descending ? sorted.reverse() : sorted;
  }, [publishers, search, sort.field, sort.descending, filter, yieldRate]);

  const paginatedPublishers = useMemo(
    () =>
      filteredSortedPublishers.slice(
        currentPage * PAGE_SIZE,
        (currentPage + 1) * PAGE_SIZE,
      ),
    [filteredSortedPublishers, currentPage],
  );

  const updateSearch = useCallback<typeof setSearch>(
    (newSearch) => {
      setSearch(newSearch);
      setPage(0);
    },
    [setSearch, setPage],
  );

  const updateSort = useCallback<typeof setSort>(
    (newSort) => {
      setSort(newSort);
      setPage(0);
    },
    [setSort, setPage],
  );

  return (
    <div className="relative w-full overflow-x-auto">
      <div className="sticky left-0 mb-4 flex flex-row items-center justify-between gap-6 px-4 text-2xl sm:px-10 sm:pb-4 sm:pt-6">
        <h3 className="font-light">{title}</h3>

        <SearchField
          value={search}
          onChange={updateSearch}
          aria-label="Search"
          className="group relative w-full max-w-96"
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
      </div>

      <table className="min-w-full text-sm">
        <thead className="bg-pythpurple-100/30 font-light">
          <tr>
            <SortablePublisherTableHeader
              field={SortField.PublisherName}
              sort={sort}
              setSort={updateSort}
              className="pl-4 text-left sm:pl-10"
            >
              Publisher
            </SortablePublisherTableHeader>
            <SortablePublisherTableHeader
              field={SortField.SelfStake}
              sort={sort}
              setSort={updateSort}
            >
              Self stake
            </SortablePublisherTableHeader>
            <SortablePublisherTableHeader
              field={SortField.PoolUtilization}
              sort={sort}
              setSort={updateSort}
            >
              Pool
            </SortablePublisherTableHeader>
            <SortablePublisherTableHeader
              field={SortField.APY}
              sort={sort}
              setSort={updateSort}
            >
              APY
            </SortablePublisherTableHeader>
            <PublisherTableHeader>Historical APY</PublisherTableHeader>
            <SortablePublisherTableHeader
              field={SortField.NumberOfFeeds}
              sort={sort}
              setSort={updateSort}
            >
              Number of feeds
            </SortablePublisherTableHeader>
            <SortablePublisherTableHeader
              field={SortField.QualityRanking}
              sort={sort}
              setSort={updateSort}
              className={clsx({ "pr-4 sm:pr-10": availableToStake <= 0n })}
            >
              Quality ranking
            </SortablePublisherTableHeader>
            {availableToStake > 0n && (
              <PublisherTableHeader className="pr-4 sm:pr-10" />
            )}
          </tr>
        </thead>

        <tbody className="bg-white/5">
          {paginatedPublishers.map((publisher) => (
            <Publisher
              key={publisher.publicKey.toBase58()}
              availableToStake={availableToStake}
              publisher={publisher}
              totalStaked={totalStaked}
              yieldRate={yieldRate}
            />
          ))}
        </tbody>
      </table>

      {filteredSortedPublishers.length > PAGE_SIZE && (
        <div className="sticky inset-x-0 flex flex-row items-center justify-end gap-2 border-t border-neutral-600/50 p-4">
          {range(Math.ceil(filteredSortedPublishers.length / PAGE_SIZE)).map(
            (page) =>
              page === currentPage ? (
                <span
                  key={page}
                  className="grid size-8 place-content-center border border-pythpurple-600 bg-pythpurple-600"
                >
                  {page + 1}
                </span>
              ) : (
                <Button
                  key={page}
                  onPress={() => {
                    setPage(page);
                  }}
                  size="nopad"
                  className="grid size-8 place-content-center"
                >
                  {page + 1}
                </Button>
              ),
          )}
        </div>
      )}
    </div>
  );
};

const range = (length: number) => [...Array.from({ length }).keys()];

type SortablePublisherTableHeaderProps = Omit<
  ComponentProps<typeof BaseButton>,
  "children"
> & {
  children: string;
  field: SortField;
  sort: { field: SortField; descending: boolean };
  setSort: Dispatch<SetStateAction<{ field: SortField; descending: boolean }>>;
};

const SortablePublisherTableHeader = ({
  field,
  sort,
  setSort,
  children,
  className,
  ...props
}: SortablePublisherTableHeaderProps) => {
  const updateSort = useCallback(() => {
    setSort((cur) => ({
      field,
      descending: cur.field === field ? !cur.descending : false,
    }));
  }, [setSort, field]);

  return (
    <th>
      <PublisherTableHeader
        as={BaseButton}
        className={clsx(
          "flex size-full flex-row items-center gap-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400",
          { "bg-black/20": sort.field === field },
          className,
        )}
        onPress={updateSort}
        {...props}
      >
        <span>{children}</span>
        <ChevronUpIcon
          className={clsx("size-4 transition-transform", {
            "rotate-180": sort.descending,
            "opacity-0": sort.field !== field,
          })}
        />
      </PublisherTableHeader>
    </th>
  );
};

const PublisherTableHeader = Styled(
  "th",
  "py-2 font-normal px-5 whitespace-nowrap",
);

type PublisherProps = {
  availableToStake: bigint;
  totalStaked: bigint;
  isSelf?: boolean;
  publisher: {
    name: string | undefined;
    publicKey: PublicKey;
    isSelf: boolean;
    selfStake: bigint;
    poolCapacity: bigint;
    poolUtilization: bigint;
    numFeeds: number;
    qualityRanking: number;
    apyHistory: { date: Date; apy: number }[];
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
};

const Publisher = ({
  publisher,
  availableToStake,
  totalStaked,
  isSelf,
  yieldRate,
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
    cancelWarmupIntegrityStaking,
    publisher.publicKey,
  );
  const unstake = useTransferActionForPublisher(
    unstakeIntegrityStaking,
    publisher.publicKey,
  );
  const utilizationPercent = useMemo(
    () =>
      publisher.poolCapacity > 0n
        ? Number((100n * publisher.poolUtilization) / publisher.poolCapacity)
        : Number.NaN,
    [publisher.poolUtilization, publisher.poolCapacity],
  );

  return (
    <>
      <tr className="border-t border-neutral-600/50 first:border-0">
        {!isSelf && (
          <>
            <PublisherTableCell className="truncate py-4 pl-4 font-medium sm:pl-10">
              {publisher.name ?? publisher.publicKey.toBase58()}
            </PublisherTableCell>
            <PublisherTableCell className="text-center">
              <Tokens>{publisher.selfStake}</Tokens>
            </PublisherTableCell>
          </>
        )}
        <PublisherTableCell className="text-center">
          <Meter value={utilizationPercent}>
            {({ percentage }) => (
              <>
                <div className="relative mx-auto grid h-5 w-52 place-content-center border border-black bg-pythpurple-600/50">
                  <div
                    style={{
                      width: `${percentage.toString()}%`,
                    }}
                    className={clsx(
                      "absolute inset-0 max-w-full",
                      percentage < 100 ? "bg-pythpurple-400" : "bg-fuchsia-900",
                    )}
                  />
                  <div
                    className={clsx("isolate text-sm font-medium", {
                      "mix-blend-difference": percentage < 100,
                    })}
                  >
                    {Number.isNaN(utilizationPercent)
                      ? "Empty Pool"
                      : `${utilizationPercent.toString()}%`}
                  </div>
                </div>
                <Label className="mt-1 flex flex-row items-center justify-center gap-1 text-sm">
                  <span>
                    <Tokens>{publisher.poolUtilization}</Tokens>
                  </span>
                  <span>/</span>
                  <span>
                    <Tokens>{publisher.poolCapacity}</Tokens>
                  </span>
                </Label>
              </>
            )}
          </Meter>
        </PublisherTableCell>
        <PublisherTableCell className="text-center">
          <div>
            {calculateApy({
              isSelf: publisher.isSelf,
              selfStake: publisher.selfStake,
              poolCapacity: publisher.poolCapacity,
              poolUtilization: publisher.poolUtilization,
              yieldRate,
            })}
            %
          </div>
        </PublisherTableCell>
        <PublisherTableCell>
          <div className="mx-auto h-14 w-28">
            <SparkChart
              data={publisher.apyHistory.map(({ date, apy }) => ({
                date,
                value: apy,
              }))}
            />
          </div>
        </PublisherTableCell>
        <PublisherTableCell className="text-center">
          {publisher.numFeeds}
        </PublisherTableCell>
        <PublisherTableCell
          className={clsx("text-center", {
            "pr-4 sm:pr-10": availableToStake <= 0n && !isSelf,
          })}
        >
          {publisher.qualityRanking}
        </PublisherTableCell>
        {availableToStake > 0 && (
          <PublisherTableCell
            className={clsx("text-right", { "pr-4 sm:pr-10": !isSelf })}
          >
            <StakeToPublisherButton
              availableToStake={availableToStake}
              poolCapacity={publisher.poolCapacity}
              poolUtilization={publisher.poolUtilization}
              publisherKey={publisher.publicKey}
              publisherName={publisher.name}
              isSelf={publisher.isSelf}
              selfStake={publisher.selfStake}
              yieldRate={yieldRate}
            />
          </PublisherTableCell>
        )}
      </tr>
      {(warmup !== undefined || staked !== undefined) && (
        <tr>
          <td colSpan={8} className="border-separate border-spacing-8">
            <div className="mx-auto mb-8 mt-4 w-[30rem] border border-neutral-600/50 bg-pythpurple-800 px-8 py-6">
              <table className="w-full">
                <caption className="mb-2 text-left text-lg font-light">
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
                          size="small"
                          variant="secondary"
                          className="w-28"
                          actionDescription={`Cancel tokens that are in warmup for staking to ${publisher.name ?? publisher.publicKey.toBase58()}`}
                          actionName="Cancel"
                          submitButtonText="Cancel Warmup"
                          title="Cancel Warmup"
                          max={warmup}
                          transfer={cancelWarmup}
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
                          <div className="text-xs opacity-60">
                            ({Number((100n * staked) / totalStaked)}% of your
                            staked tokens)
                          </div>
                        </div>
                      </td>
                      <td className="py-0.5 text-right">
                        <TransferButton
                          size="small"
                          variant="secondary"
                          className="w-28"
                          actionDescription={`Unstake tokens from ${publisher.name ?? publisher.publicKey.toBase58()}`}
                          actionName="Unstake"
                          max={staked}
                          transfer={unstake}
                        >
                          <StakingTimeline cooldownOnly />
                        </TransferButton>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const PublisherTableCell = Styled("td", "py-4 px-5 whitespace-nowrap");

type StakeToPublisherButtonProps = {
  publisherName: string | undefined;
  publisherKey: PublicKey;
  availableToStake: bigint;
  poolCapacity: bigint;
  poolUtilization: bigint;
  isSelf: boolean;
  selfStake: bigint;
  yieldRate: bigint;
};

const StakeToPublisherButton = ({
  publisherName,
  publisherKey,
  poolCapacity,
  poolUtilization,
  availableToStake,
  isSelf,
  selfStake,
  yieldRate,
}: StakeToPublisherButtonProps) => {
  const delegate = useTransferActionForPublisher(
    delegateIntegrityStaking,
    publisherKey,
  );

  return (
    <TransferButton
      size="small"
      actionDescription={`Stake to ${publisherName ?? publisherKey.toBase58()}`}
      actionName="Stake"
      max={availableToStake}
      transfer={delegate}
    >
      {(amount) => (
        <>
          <div className="mb-8 flex flex-row items-center justify-between text-sm">
            <div>APY after staking</div>
            <div className="font-medium">
              {isSelf
                ? calculateApy({
                    isSelf,
                    selfStake:
                      selfStake +
                      (amount.type === AmountType.Valid ? amount.amount : 0n),
                    poolCapacity,
                    yieldRate,
                  })
                : calculateApy({
                    isSelf,
                    selfStake,
                    poolCapacity,
                    poolUtilization:
                      poolUtilization +
                      (amount.type === AmountType.Valid ? amount.amount : 0n),
                    yieldRate,
                  })}
              %
            </div>
          </div>
          <StakingTimeline />
        </>
      )}
    </TransferButton>
  );
};

const useTransferActionForPublisher = (
  action: (
    client: PythStakingClient,
    stakingAccount: PublicKey,
    publisher: PublicKey,
    amount: bigint,
  ) => Promise<void>,
  publisher: PublicKey,
) =>
  useCallback(
    (client: PythStakingClient, stakingAccount: PublicKey, amount: bigint) =>
      action(client, stakingAccount, publisher, amount),
    [action, publisher],
  );

const hasAnyPositions = ({ positions }: PublisherProps["publisher"]) =>
  positions !== undefined &&
  [
    positions.warmup,
    positions.staked,
    positions.cooldown,
    positions.cooldown2,
  ].some((value) => value !== undefined && value > 0n);

enum SortField {
  PublisherName,
  PoolUtilization,
  APY,
  SelfStake,
  NumberOfFeeds,
  QualityRanking,
}
