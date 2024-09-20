import {
  ChevronUpIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  ChevronDownIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/outline";
import { calculateApy } from "@pythnetwork/staking-sdk";
import { PublicKey } from "@solana/web3.js";
import clsx from "clsx";
import {
  useMemo,
  useCallback,
  useState,
  useRef,
  type ComponentProps,
  type Dispatch,
  type SetStateAction,
  type HTMLAttributes,
  type FormEvent,
} from "react";
import { useFilter } from "react-aria";
import {
  SearchField,
  Input,
  Button as BaseButton,
  Meter,
  Label,
  TextField,
  Form,
  Switch,
  MenuTrigger,
  Select,
  Popover,
  ListBox,
  ListBoxItem,
} from "react-aria-components";

import { type States, StateType as ApiStateType } from "../../hooks/use-api";
import {
  StateType as UseAsyncStateType,
  useAsync,
} from "../../hooks/use-async";
import { Button, LinkButton } from "../Button";
import { CopyButton } from "../CopyButton";
import { Menu, MenuItem, Section, Separator } from "../Menu";
import { ModalDialog } from "../ModalDialog";
import { OracleIntegrityStakingGuide } from "../OracleIntegrityStakingGuide";
import { ProgramSection } from "../ProgramSection";
import { PublisherFaq } from "../PublisherFaq";
import { SparkChart } from "../SparkChart";
import { StakingTimeline } from "../StakingTimeline";
import { Styled } from "../Styled";
import { Tokens } from "../Tokens";
import { AmountType, TransferButton } from "../TransferButton";
import { TruncatedKey } from "../TruncatedKey";

const PAGE_SIZE = 10;

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

  return (
    <ProgramSection
      name="Oracle Integrity Staking (OIS)"
      tagline="Protect DeFi"
      description="OIS allows anyone to help secure Pyth and protect DeFi. Through decentralized staking rewards and slashing, OIS incentivizes Pyth publishers to maintain high-quality data contributions. PYTH holders can stake to publishers to further reinforce oracle security. Rewards are programmatically distributed to high quality publishers and the stakers supporting them to strengthen oracle integrity."
      helpDialog={<OracleIntegrityStakingGuide />}
      className="pb-0 sm:pb-0"
      collapseTokenOverview
      tokenOverview={{
        currentEpoch,
        available: availableToStake,
        warmup,
        staked,
        cooldown,
        cooldown2,
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
          self={self}
          currentEpoch={currentEpoch}
          availableToStake={availableToStake}
          yieldRate={yieldRate}
        />
      )}
      <div
        className={clsx(
          "relative -mx-4 overflow-hidden border-t border-neutral-600/50 pt-6 sm:-mx-8 lg:mt-10",
          { "mt-6 sm:mt-12": self === undefined },
        )}
      >
        <PublisherList
          api={api}
          currentEpoch={currentEpoch}
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
              <PublisherName
                truncatedClassName="2xl:hidden"
                fullClassName="hidden 2xl:inline"
                className="opacity-60"
              >
                {self}
              </PublisherName>
            </div>
            <div className="flex flex-row items-center gap-4">
              <MenuTrigger>
                <Button
                  variant="secondary"
                  className="group flex flex-row items-center gap-2 lg:hidden"
                >
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
                href="https://pyth-network.notion.site/Oracle-Integrity-Staking-OIS-Guide-for-Pyth-Network-MDPs-2755c872a7c44aefabfa9987ba7ec8ae"
                target="_blank"
                size="small"
                className="hidden lg:block"
              >
                Publisher Guide
              </LinkButton>
              <Button
                size="small"
                onPress={openPublisherFaq}
                className="hidden lg:block"
              >
                Publisher FAQ
              </Button>
              <Button
                variant="secondary"
                size="small"
                onPress={openReassignStakeAccount}
                className="hidden lg:block"
              >
                Reassign Stake Account
              </Button>
              <Button
                variant="secondary"
                size="small"
                onPress={openOptOut}
                className="hidden lg:block"
              >
                Opt Out of Rewards
              </Button>
            </div>
          </div>

          <div className="border-neutral-600/50 bg-pythpurple-400/10 sm:mx-12 sm:mb-4 sm:border sm:border-t-0 md:mx-20 xl:hidden">
            <Publisher
              api={api}
              currentEpoch={currentEpoch}
              availableToStake={availableToStake}
              publisher={self}
              totalStaked={self.positions?.staked ?? 0n}
              yieldRate={yieldRate}
              isSelf
              compact
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
                {availableToStake > 0n && <PublisherTableHeader />}
              </tr>
            </thead>
            <tbody className="bg-pythpurple-400/10">
              <Publisher
                api={api}
                isSelf
                currentEpoch={currentEpoch}
                availableToStake={availableToStake}
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
        self={self}
        isOpen={reassignStakeAccountOpen}
        onOpenChange={setReassignStakeAccountOpen}
      />
      <OptOut
        api={api}
        self={self}
        isOpen={optOutOpen}
        onOpenChange={setOptOutOpen}
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
    <ModalDialog title="You must unstake first" closeButtonText="Ok" {...props}>
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
      title="Reassign Stake Account"
      closeDisabled={closeDisabled}
      description={
        <>
          <span className="mr-3 align-middle">
            Designate a different stake account as the self-staking account for
          </span>
          <PublisherName className="font-semibold">{self}</PublisherName>
        </>
      }
      {...props}
    >
      {({ close }) => (
        <ReassignStakeAccountForm
          api={api}
          publisherPubkey={self.publicKey}
          close={close}
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

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setCloseDisabled(true);
      execute()
        .then(() => {
          close();
        })
        .catch(() => {
          /* no-op since this is already handled in the UI using `state` and is logged in useTransfer */
        })
        .finally(() => {
          setCloseDisabled(false);
        });
    },
    [execute, close, setCloseDisabled],
  );

  return (
    <Form onSubmit={handleSubmit}>
      <TextField
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        isInvalid={key === undefined}
        value={value}
        onChange={setValue}
        validationBehavior="aria"
        name="publicKey"
        className="mb-8 flex w-full flex-col gap-1 sm:min-w-96"
      >
        <div className="flex flex-row items-center justify-between">
          <Label>New stake account public key</Label>
        </div>
        <Input
          required
          className="focused:outline-none focused:ring-0 focused:border-pythpurple-400 w-full truncate border border-neutral-600/50 bg-transparent p-3 focus:border-pythpurple-400 focus:outline-none focus:ring-0 focus-visible:border-pythpurple-400 focus-visible:outline-none focus-visible:ring-0"
          placeholder={PublicKey.default.toBase58()}
        />
        {state.type === UseAsyncStateType.Error && (
          <p className="mt-1 text-red-600">
            Uh oh, an error occurred! Please try again
          </p>
        )}
      </TextField>
      <Button
        className="mt-6 w-full"
        type="submit"
        isLoading={state.type === UseAsyncStateType.Running}
        isDisabled={key === undefined}
      >
        <ReassignStakeAccountButtonContents value={value} publicKey={key} />
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
  const { state, execute } = useAsync(() =>
    api.optPublisherOut(self.publicKey),
  );

  const doOptOut = useCallback(() => {
    execute().catch(() => {
      /* no-op since this is already handled in the UI using `state` and is logged in useTransfer */
    });
  }, [execute]);

  return hasAnyPositions(self) ? (
    <ModalDialog title="You must unstake first" closeButtonText="Ok" {...props}>
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
        <>
          <div className="flex max-w-prose flex-col gap-4">
            <p className="font-semibold">
              Are you sure you want to opt out of rewards?
            </p>
            <p className="opacity-90">
              Opting out of rewards will prevent you from earning the publisher
              yield rate and delegation fees from your delegators. You will
              still be able to participate in OIS after opting out of rewards.
            </p>
          </div>
          {state.type === UseAsyncStateType.Error && (
            <p className="mt-8 text-red-600">
              Uh oh, an error occurred! Please try again
            </p>
          )}
          <div className="mt-14 flex flex-col gap-8 sm:flex-row sm:justify-between">
            <Button
              className="w-full sm:w-auto"
              size="noshrink"
              onPress={close}
            >
              No, I want rewards!
            </Button>
            <Button
              className="w-full sm:w-auto"
              variant="secondary"
              size="noshrink"
              isLoading={state.type === UseAsyncStateType.Running}
              onPress={doOptOut}
            >
              Yes, opt me out
            </Button>
          </div>
        </>
      )}
    </ModalDialog>
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
  const scrollTarget = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState("");
  const [yoursFirst, setYoursFirst] = useState(true);
  const [sort, setSort] = useState({
    field: SortField.PoolUtilization,
    descending: true,
  });
  const filter = useFilter({ sensitivity: "base", usage: "search" });
  const [currentPage, setPage] = useState(0);
  const filteredSortedPublishers = useMemo(
    () =>
      publishers
        .filter(
          (publisher) =>
            filter.contains(publisher.publicKey.toBase58(), search) ||
            (publisher.name !== undefined &&
              filter.contains(publisher.name, search)),
        )
        .sort((a, b) => {
          if (yoursFirst) {
            const aHasPositions = hasAnyPositions(a);
            const bHasPositions = hasAnyPositions(b);
            if (aHasPositions && !bHasPositions) {
              return -1;
            } else if (bHasPositions && !aHasPositions) {
              return 1;
            }
          }
          const sortResult = doSort(a, b, yieldRate, sort.field);
          return sort.descending ? sortResult * -1 : sortResult;
        }),
    [
      publishers,
      search,
      sort.field,
      sort.descending,
      filter,
      yieldRate,
      yoursFirst,
    ],
  );

  const paginatedPublishers = useMemo(
    () =>
      filteredSortedPublishers.slice(
        currentPage * PAGE_SIZE,
        (currentPage + 1) * PAGE_SIZE,
      ),
    [filteredSortedPublishers, currentPage],
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
      updatePage(0);
    },
    [setSearch, updatePage],
  );

  const updateSort = useCallback<typeof setSort>(
    (newSort) => {
      setSort(newSort);
      updatePage(0);
    },
    [setSort, updatePage],
  );

  const updateYoursFirst = useCallback<typeof setYoursFirst>(
    (newYoursFirst) => {
      setYoursFirst(newYoursFirst);
      updatePage(0);
    },
    [setYoursFirst, updatePage],
  );

  const numPages = useMemo(
    () => Math.floor(filteredSortedPublishers.length / PAGE_SIZE),
    [filteredSortedPublishers],
  );

  return (
    <div className="relative w-full overflow-x-auto">
      <div ref={scrollTarget} />
      <div className="sticky left-0 mb-4 flex flex-col gap-4 px-4 sm:px-10 sm:pb-4 sm:pt-6 md:flex-row md:justify-between md:gap-12 lg:items-start">
        <h3 className="flex-none text-2xl font-light md:mt-1">{title}</h3>

        <div className="flex flex-none grow flex-col items-end gap-2 xl:flex-row-reverse xl:items-center xl:justify-start xl:gap-8 2xl:gap-16">
          <SearchField
            value={search}
            onChange={updateSearch}
            aria-label="Search"
            className="group relative w-full md:max-w-96 xl:max-w-64 2xl:max-w-96"
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
            className="flex flex-row items-center gap-2 2xl:hidden"
            selectedKey={sort.field}
            onSelectionChange={(field) => {
              updateSort({
                field: field as SortField,
                descending:
                  field === SortField.NumberOfFeeds ||
                  field === SortField.APY ||
                  field === SortField.SelfStake,
              });
            }}
          >
            <Label className="whitespace-nowrap opacity-80">Sort by</Label>
            <Button className="group flex flex-row items-center gap-2 text-xs transition">
              {SORT_FIELD_TO_NAME[sort.field]}
              <ChevronDownIcon className="size-4 flex-none opacity-60 transition duration-300 group-data-[pressed]:-rotate-180" />
            </Button>
            <Popover
              placement="bottom end"
              className="data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:fade-in data-[exiting]:fade-out"
            >
              <ListBox
                className="flex origin-top-right flex-col border border-neutral-400 bg-pythpurple-100 py-2 text-sm text-pythpurple-950 shadow shadow-neutral-400 outline-none"
                items={[
                  { id: SortField.PublisherName },
                  { id: SortField.PoolUtilization },
                  { id: SortField.APY },
                  { id: SortField.SelfStake },
                  { id: SortField.NumberOfFeeds },
                  { id: SortField.QualityRanking },
                ]}
              >
                {({ id }) => (
                  <ListBoxItem className="flex cursor-pointer items-center gap-2 whitespace-nowrap px-4 py-2 text-left data-[disabled]:cursor-default data-[focused]:bg-pythpurple-800/20 data-[has-submenu]:data-[open]:bg-pythpurple-800/10 data-[has-submenu]:data-[open]:data-[focused]:bg-pythpurple-800/20 focus:outline-none focus-visible:outline-none">
                    {SORT_FIELD_TO_NAME[id]}
                  </ListBoxItem>
                )}
              </ListBox>
            </Popover>
          </Select>
          <Switch
            isSelected={yoursFirst}
            onChange={updateYoursFirst}
            className="group flex cursor-pointer flex-row items-center gap-2"
          >
            <div className="whitespace-nowrap opacity-80">
              Show your positions first
            </div>
            <div className="h-8 w-16 flex-none rounded-full border border-neutral-400/50 bg-neutral-800/50 p-1 transition group-data-[selected]:border-pythpurple-600 group-data-[selected]:bg-pythpurple-600/10">
              <div className="aspect-square h-full rounded-full bg-neutral-400/50 transition group-data-[selected]:translate-x-8 group-data-[selected]:bg-pythpurple-600" />
            </div>
          </Switch>
        </div>
      </div>

      {filteredSortedPublishers.length > 0 ? (
        <>
          <ul className="bg-white/5 2xl:hidden">
            {paginatedPublishers.map((publisher) => (
              <li key={publisher.publicKey.toBase58()}>
                <Publisher
                  api={api}
                  currentEpoch={currentEpoch}
                  availableToStake={availableToStake}
                  publisher={publisher}
                  totalStaked={totalStaked}
                  yieldRate={yieldRate}
                  compact
                />
              </li>
            ))}
          </ul>
          <table className="hidden min-w-full text-sm 2xl:table">
            <thead className="bg-pythpurple-100/30 font-light">
              <tr>
                <SortablePublisherTableHeader
                  field={SortField.PublisherName}
                  sort={sort}
                  setSort={updateSort}
                  alignment="left"
                  className="pl-4 sm:pl-10"
                >
                  Publisher
                </SortablePublisherTableHeader>
                <SortablePublisherTableHeader
                  field={SortField.SelfStake}
                  sort={sort}
                  setSort={updateSort}
                >
                  {"Publisher's stake"}
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
                  Estimated next APY
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
                >
                  Quality ranking
                </SortablePublisherTableHeader>
                <PublisherTableHeader className="pr-4 sm:pr-10" />
              </tr>
            </thead>

            <tbody className="bg-white/5">
              {paginatedPublishers.map((publisher) => (
                <Publisher
                  api={api}
                  currentEpoch={currentEpoch}
                  key={publisher.publicKey.toBase58()}
                  availableToStake={availableToStake}
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
        <Paginator
          currentPage={currentPage}
          numPages={numPages}
          onPageChange={updatePage}
        />
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
    <ul className="sticky inset-x-0 flex flex-row items-center justify-end gap-2 border-t border-neutral-600/50 p-4">
      {currentPage > 1 && (
        <li>
          <Button
            onPress={() => {
              onPageChange(1);
            }}
            size="nopad"
            variant="secondary"
            className="grid size-8 place-content-center"
          >
            <ChevronDoubleLeftIcon className="size-4" />
          </Button>
        </li>
      )}
      {pages.map((page) =>
        page === currentPage ? (
          <li
            key={page}
            className="grid size-8 place-content-center border border-pythpurple-600 bg-pythpurple-600"
          >
            {page}
          </li>
        ) : (
          <li key={page}>
            <Button
              key={page}
              onPress={() => {
                onPageChange(page);
              }}
              size="nopad"
              className="grid size-8 place-content-center"
            >
              {page}
            </Button>
          </li>
        ),
      )}
      {currentPage < numPages && (
        <li>
          <Button
            onPress={() => {
              onPageChange(numPages);
            }}
            size="nopad"
            variant="secondary"
            className="grid size-8 place-content-center"
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
  return { first, count: Math.min(numPages - first + 1, 5) };
};

const doSort = (
  a: PublisherProps["publisher"],
  b: PublisherProps["publisher"],
  yieldRate: bigint,
  sortField: SortField,
): number => {
  switch (sortField) {
    case SortField.PublisherName: {
      return (a.name ?? a.publicKey.toBase58()).localeCompare(
        b.name ?? b.publicKey.toBase58(),
      );
    }
    case SortField.APY: {
      return (
        calculateApy({
          isSelf: false,
          selfStake: a.selfStake + a.selfStakeDelta,
          poolCapacity: a.poolCapacity,
          poolUtilization: a.poolUtilization + a.poolUtilizationDelta,
          yieldRate,
        }) -
        calculateApy({
          isSelf: false,
          selfStake: b.selfStake + b.selfStakeDelta,
          poolCapacity: b.poolCapacity,
          poolUtilization: b.poolUtilization + b.poolUtilizationDelta,
          yieldRate,
        })
      );
    }
    case SortField.NumberOfFeeds: {
      return Number(a.numFeeds - b.numFeeds);
    }
    case SortField.PoolUtilization: {
      const value = Number(
        (a.poolUtilization + a.poolUtilizationDelta) * b.poolCapacity -
          (b.poolUtilization + b.poolUtilizationDelta) * a.poolCapacity,
      );
      return value === 0 ? Number(a.poolCapacity - b.poolCapacity) : value;
    }
    case SortField.QualityRanking: {
      if (a.qualityRanking === 0 && b.qualityRanking === 0) {
        return 0;
      } else if (a.qualityRanking === 0) {
        return 1;
      } else if (b.qualityRanking === 0) {
        return -1;
      } else {
        return Number(a.qualityRanking - b.qualityRanking);
      }
    }
    case SortField.SelfStake: {
      return Number(a.selfStake - b.selfStake);
    }
  }
};

type SortablePublisherTableHeaderProps = Omit<
  ComponentProps<typeof BaseButton>,
  "children"
> & {
  children: string;
  field: SortField;
  sort: { field: SortField; descending: boolean };
  setSort: Dispatch<SetStateAction<{ field: SortField; descending: boolean }>>;
  alignment?: "left" | "right";
};

const SortablePublisherTableHeader = ({
  field,
  sort,
  setSort,
  children,
  className,
  alignment,
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
          "group size-full data-[sorted]:bg-black/20 data-[alignment=center]:data-[sorted]:px-2.5 data-[alignment=left]:text-left data-[alignment=right]:text-right focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400",
          className,
        )}
        onPress={updateSort}
        {...(sort.field === field && { "data-sorted": true })}
        {...(sort.descending && { "data-descending": true })}
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
    name: string | undefined;
    publicKey: PublicKey;
    stakeAccount: PublicKey | undefined;
    selfStake: bigint;
    selfStakeDelta: bigint;
    poolCapacity: bigint;
    poolUtilization: bigint;
    poolUtilizationDelta: bigint;
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
  compact?: boolean | undefined;
};

const Publisher = ({
  api,
  currentEpoch,
  publisher,
  availableToStake,
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
        isSelf: isSelf ?? false,
        selfStake: publisher.selfStake + publisher.selfStakeDelta,
        poolCapacity: publisher.poolCapacity,
        poolUtilization:
          publisher.poolUtilization + publisher.poolUtilizationDelta,
        yieldRate,
      }).toFixed(2),
    [
      isSelf,
      publisher.selfStake,
      publisher.selfStakeDelta,
      publisher.poolCapacity,
      publisher.poolUtilization,
      publisher.poolUtilizationDelta,
      yieldRate,
    ],
  );

  return compact ? (
    <div className="border-t border-neutral-600/50 p-4 sm:px-10">
      {!isSelf && (
        <div className="flex flex-row items-center justify-between">
          <PublisherName
            className="font-semibold"
            truncatedClassName="sm:hidden"
            fullClassName="hidden sm:inline"
          >
            {publisher}
          </PublisherName>
          <StakeToPublisherButton
            api={api}
            currentEpoch={currentEpoch}
            availableToStake={availableToStake}
            publisher={publisher}
            yieldRate={yieldRate}
            isSelf={isSelf ?? false}
          />
        </div>
      )}
      <div className="gap-8 xs:flex xs:flex-row-reverse xs:items-center xs:justify-between">
        <div className="flex grow flex-col gap-2 xs:items-end">
          {isSelf && (
            <StakeToPublisherButton
              api={api}
              currentEpoch={currentEpoch}
              availableToStake={availableToStake}
              publisher={publisher}
              yieldRate={yieldRate}
              isSelf
            />
          )}
          <UtilizationMeter
            publisher={publisher}
            className="mx-auto my-4 w-full grow xs:mx-0 sm:w-auto sm:flex-none"
          />
        </div>
        <dl className="flex-none text-xs">
          {!isSelf && (
            <div className="flex flex-row items-center gap-2">
              <dt className="font-semibold">{"Publisher's Stake:"}</dt>
              <dd>
                <Tokens>{publisher.selfStake}</Tokens>
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
      {(warmup !== undefined || staked !== undefined) && (
        <YourPositionsTable
          publisher={publisher}
          warmup={warmup}
          cancelWarmup={cancelWarmup}
          staked={staked}
          totalStaked={totalStaked}
          unstake={unstake}
          currentEpoch={currentEpoch}
        />
      )}
    </div>
  ) : (
    <>
      <tr className="border-t border-neutral-600/50 first:border-0">
        {!isSelf && (
          <>
            <PublisherTableCell className="truncate py-4 pl-4 font-medium sm:pl-10">
              <PublisherName
                truncatedClassName="3xl:hidden"
                fullClassName="hidden 3xl:inline"
              >
                {publisher}
              </PublisherName>
            </PublisherTableCell>
            <PublisherTableCell className="text-center">
              <Tokens>{publisher.selfStake}</Tokens>
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
        <PublisherTableCell className="text-center">
          {publisher.qualityRanking === 0 ? "-" : publisher.qualityRanking}
        </PublisherTableCell>
        <PublisherTableCell
          className={clsx("text-right", { "pr-4 sm:pr-10": !isSelf })}
        >
          <StakeToPublisherButton
            api={api}
            currentEpoch={currentEpoch}
            availableToStake={availableToStake}
            publisher={publisher}
            yieldRate={yieldRate}
            isSelf={isSelf ?? false}
          />
        </PublisherTableCell>
      </tr>
      {(warmup !== undefined || staked !== undefined) && (
        <tr>
          <td colSpan={8} className="border-separate border-spacing-8">
            <YourPositionsTable
              publisher={publisher}
              warmup={warmup}
              cancelWarmup={cancelWarmup}
              staked={staked}
              totalStaked={totalStaked}
              unstake={unstake}
              currentEpoch={currentEpoch}
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
  <div className="mx-auto mb-0 mt-4 border border-neutral-600/50 bg-pythpurple-800 p-4 text-xs sm:mb-4 sm:px-8 sm:py-6 md:mb-8 md:w-[30rem]">
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
                size="small"
                variant="secondary"
                className="w-28"
                actionDescription={
                  <>
                    <span className="mr-3 align-middle">
                      Cancel tokens that are in warmup for staking to
                    </span>
                    <PublisherName className="font-semibold">
                      {publisher}
                    </PublisherName>
                  </>
                }
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
                <div className="hidden text-xs opacity-60 xs:block">
                  ({Number((100n * staked) / totalStaked)}% of your staked
                  tokens)
                </div>
              </div>
            </td>
            <td className="py-0.5 text-right">
              <TransferButton
                size="small"
                variant="secondary"
                className="md:w-28"
                actionDescription={
                  <>
                    <span className="mr-3 align-middle">
                      Unstake tokens from
                    </span>
                    <PublisherName className="font-semibold">
                      {publisher}
                    </PublisherName>
                  </>
                }
                actionName="Unstake"
                max={staked}
                transfer={unstake}
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

type StakeToPublisherButtonProps = {
  api: States[ApiStateType.Loaded] | States[ApiStateType.LoadedNoStakeAccount];
  publisher: PublisherProps["publisher"];
  currentEpoch: bigint;
  availableToStake: bigint;
  yieldRate: bigint;
  isSelf: boolean;
};

const StakeToPublisherButton = ({
  api,
  currentEpoch,
  availableToStake,
  publisher,
  yieldRate,
  isSelf,
}: StakeToPublisherButtonProps) => {
  const delegate = useTransferActionForPublisher(
    api.type === ApiStateType.Loaded ? api.delegateIntegrityStaking : undefined,
    publisher.publicKey,
  );

  return (
    <TransferButton
      size="small"
      actionDescription={
        <>
          <span className="mr-3 align-middle">Stake to</span>
          <PublisherName className="font-semibold">{publisher}</PublisherName>
        </>
      }
      actionName="Stake"
      max={availableToStake}
      transfer={delegate}
    >
      {(amount) => (
        <>
          <div className="mb-8 flex flex-row items-center justify-between text-sm">
            <div>APY after staking</div>
            <NewApy
              className="font-medium"
              isSelf={isSelf}
              publisher={publisher}
              yieldRate={yieldRate}
            >
              {amount.type === AmountType.Valid ||
              amount.type === AmountType.AboveMax
                ? amount.amount
                : 0n}
            </NewApy>
          </div>
          <StakingTimeline currentEpoch={currentEpoch} />
        </>
      )}
    </TransferButton>
  );
};

type NewApyProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  isSelf: boolean;
  publisher: PublisherProps["publisher"];
  yieldRate: bigint;
  children: bigint;
};

const NewApy = ({
  isSelf,
  publisher,
  yieldRate,
  children,
  ...props
}: NewApyProps) => {
  const apy = useMemo(
    () =>
      calculateApy({
        poolCapacity: publisher.poolCapacity,
        yieldRate,
        ...(isSelf
          ? {
              isSelf: true,
              selfStake:
                publisher.selfStake + publisher.selfStakeDelta + children,
            }
          : {
              isSelf: false,
              selfStake: publisher.selfStake,
              poolUtilization:
                publisher.poolUtilization +
                publisher.poolUtilizationDelta +
                children,
            }),
      }),
    [
      publisher.poolCapacity,
      yieldRate,
      isSelf,
      publisher.selfStake,
      publisher.selfStakeDelta,
      publisher.poolUtilization,
      publisher.poolUtilizationDelta,
      children,
    ],
  );

  return <div {...props}>{apy}%</div>;
};

type PublisherNameProps = {
  className?: string | undefined;
  children: PublisherProps["publisher"];
  fullClassName?: string;
  truncatedClassName?: string;
};

const PublisherName = ({
  children,
  fullClassName,
  truncatedClassName,
  className,
}: PublisherNameProps) =>
  children.name ? (
    <span className={className}>{children.name}</span>
  ) : (
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

const SORT_FIELD_TO_NAME: Record<SortField, string> = {
  [SortField.PublisherName]: "Publisher Name",
  [SortField.PoolUtilization]: "Pool Utilization",
  [SortField.APY]: "Estimated Next APY",
  [SortField.SelfStake]: "Publisher's Stake",
  [SortField.NumberOfFeeds]: "Number of Feeds",
  [SortField.QualityRanking]: "Quality Ranking",
} as const;

class InvalidKeyError extends Error {
  constructor() {
    super("Invalid public key");
  }
}
