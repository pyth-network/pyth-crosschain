import { WalletIcon } from "@heroicons/react/24/outline";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import clsx from "clsx";
import type { StaticImageData } from "next/image";
import Image from "next/image";
import type { ReactNode, ComponentType, SVGProps, ComponentProps } from "react";
import { useCallback, useState, useRef, useEffect } from "react";
import { Tabs, TabList, Tab, TabPanel } from "react-aria-components";

import governance from "./governance.png";
import Info from "./info.svg";
import ObtainRewards from "./obtain-rewards.svg";
import ois from "./ois.png";
import Safebox from "./safebox.svg";
import SelectPublishers from "./select-publishers.svg";
import TokenWarmup from "./token-warmup.svg";
import { Button } from "../Button";

export const NoWalletHome = () => {
  const modal = useWalletModal();
  const showModal = useCallback(() => {
    modal.setVisible(true);
  }, [modal]);
  const lastTab = useRef<
    Exclude<ComponentProps<typeof Tabs>["selectedKey"], undefined>
  >(TabId.IntegrityStaking);
  const [tab, setTab] = useState<
    Exclude<ComponentProps<typeof Tabs>["selectedKey"], undefined>
  >(TabId.IntegrityStaking);
  const scrollTarget = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollTarget.current && tab !== lastTab.current) {
      lastTab.current = tab;
      scrollTarget.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [tab]);

  return (
    <main className="flex flex-col items-center">
      <div className="mb-10 mt-6 flex flex-col gap-6 text-center md:mb-20 md:mt-12 md:gap-12">
        <div className="text-sm/normal tracking-[0.5rem]">
          WELCOME
          <br />
          TO THE PYTH STAKING
          <br />
          DASHBOARD
        </div>
        <h1 className="text-5xl/tight font-light md:text-7xl">
          Choose Your Journey
        </h1>
        <p className="text-lg">You can participate in both programs.</p>
        <Button onPress={showModal} className="px-10 py-4" size="nopad">
          <WalletIcon className="size-4" />
          <div>Connect wallet</div>
        </Button>
      </div>

      <Tabs selectedKey={tab} onSelectionChange={setTab}>
        <div ref={scrollTarget} />

        <div className="relative mx-auto max-h-96 overflow-hidden md:hidden">
          <div className="absolute inset-0 bg-[#E6DAFE] mix-blend-color" />
          <Image
            src={tab === TabId.IntegrityStaking ? ois : governance}
            alt=""
            className="size-full sm:-mt-28"
          />
          <div className="absolute inset-0 top-12 text-center text-2xl text-pythpurple-800">
            {tab === TabId.IntegrityStaking ? (
              <>
                <span>Secure the Oracle</span>
                <br />
                <span className="font-semibold">to Earn Rewards</span>
              </>
            ) : (
              <>
                <span>Gain Voting Power</span>
                <br />
                <span className="font-semibold">for Governance</span>
              </>
            )}
          </div>
        </div>

        <TabList className="sticky top-header-height -mx-4 mb-8 flex max-w-7xl flex-row items-stretch justify-center gap-2 border border-neutral-600/50 bg-pythpurple-800 px-4 py-2 md:static md:border-none md:bg-transparent md:p-0">
          <ProgramTab
            id={TabId.IntegrityStaking}
            image={ois}
            description={
              <>
                <span>Secure the Oracle</span>
                <br />
                <span className="font-semibold">to Earn Rewards</span>
              </>
            }
          >
            Oracle Integrity Staking
          </ProgramTab>
          <ProgramTab
            id={TabId.Governance}
            image={governance}
            description={
              <>
                <span>Gain Voting Power</span>
                <br />
                <span className="font-semibold">for Governance</span>
              </>
            }
          >
            Pyth Governance
          </ProgramTab>
        </TabList>

        <ProgramPanel
          id={TabId.IntegrityStaking}
          header="Oracle Integrity Staking"
          eyebrow="SECURE THE ORACLE TO EARN REWARDS"
          steps={[
            {
              title: "Add Tokens",
              body: "Add your PYTH tokens into the Staking Dashboard smart contract. Staking these tokens in Oracle Integrity Staking lets you secure Pyth’s price oracle and protect DeFi.",
              icon: Safebox,
            },
            {
              title: "Select Publishers",
              body: "Choose which data publishers to support by staking your tokens towards them to help secure the oracle. You can sort publishers by their stake pool details, quality ranking, and more.",
              icon: SelectPublishers,
            },
            {
              title: "Token Warmup",
              body: "Once you confirm your choice to stake to a publisher, your tokens will first enter a brief warmup period before they become staked. Staked tokens are subject to programmatic rewards and slashing penalties based on publisher performance.",
              icon: TokenWarmup,
            },
            {
              title: "Secure Pyth to Obtain Rewards",
              body: "The protocol programmatically distributes rewards to publishers who contributed high quality data, and then distributes remaining rewards to the stakers who supported these publishers. Rewards are calculated every epoch (i.e. one week period).",
              icon: ObtainRewards,
            },
          ]}
        />

        <ProgramPanel
          id={TabId.Governance}
          header="Pyth Governance"
          eyebrow="GAIN VOTING POWER FOR GOVERNANCE"
          steps={[
            {
              title: "Add Tokens",
              body: "Add your PYTH tokens into the Staking Dashboard smart contract. Staking these tokens in Pyth Governance gives you voting power for key decisions in helping shape the oracle network.",
              icon: Safebox,
            },
            {
              title: "Token Warmup",
              body: "Once you confirm your choice to stake, your tokens will first enter a brief warmup period before they become staked. Once your tokens become staked, they will confer voting power.",
              icon: TokenWarmup,
            },
            {
              title: "Vote & Govern",
              body: "You can cast your vote on Pyth Improvement Proposals (PIPs) in the Pyth Network Realm. By participating in governance, you help shape the direction of the Pyth Network and ensure its continued growth and stability.",
              icon: SelectPublishers,
            },
          ]}
        />
      </Tabs>

      <div className="my-20 flex flex-col items-center gap-12 text-center md:my-32">
        <div className="flex flex-col items-center gap-6 px-6">
          <h2 className="text-6xl font-light md:text-7xl">Get Started</h2>
          <p className="mx-auto max-w-[30rem] text-lg opacity-50">
            Connect your wallet to get started with either Oracle Integrity
            Staking or Pyth Governance.
          </p>
        </div>
        <Button onPress={showModal} className="px-10 py-4" size="nopad">
          <WalletIcon className="size-4" />
          <span>Connect wallet</span>
        </Button>
      </div>

      <div className="mb-12 flex max-w-[50rem] flex-row gap-2 border border-neutral-600/50 bg-pythpurple-800 px-4 py-8 sm:items-center sm:gap-4 md:gap-8 md:px-12 md:py-8">
        <Info className="size-16 flex-none" />
        <div className="text-lg/tight font-light">
          You can stake your PYTH tokens in either or both the Oracle Integrity
          Staking and Pyth Governance programs.
        </div>
      </div>
    </main>
  );
};

type ProgramTabProps = ComponentProps<typeof Tab> & {
  description: ReactNode;
  children: ReactNode;
  image: StaticImageData;
};

const ProgramTab = ({
  description,
  className,
  children,
  image,
  ...props
}: ProgramTabProps) => (
  <Tab
    className={clsx(
      "group flex flex-1 cursor-pointer flex-col items-center data-[selected]:cursor-default focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400",
      className,
    )}
    {...props}
  >
    <div className="relative hidden w-4/5 opacity-30 transition group-hover:opacity-60 group-data-[selected]:opacity-100 md:block">
      <div className="absolute inset-0 bg-[#E6DAFE] mix-blend-color" />
      <Image src={image} alt="" className="size-full" />
      <div className="absolute inset-0 top-16 text-center text-2xl text-pythpurple-800 lg:text-3xl">
        {description}
      </div>
    </div>
    <div className="size-full border border-transparent text-center font-semibold leading-none transition group-data-[selected]:border-pythpurple-400 group-data-[selected]:bg-pythpurple-600 md:border-neutral-600/50 md:bg-pythpurple-800 md:text-lg md:group-data-[selected]:border-pythpurple-400">
      <div className="grid size-full place-content-center p-2 group-hover:bg-pythpurple-600/60 md:p-4">
        {children}
      </div>
    </div>
  </Tab>
);

type ProgramPanelProps = ComponentProps<typeof TabPanel> & {
  header: ReactNode;
  eyebrow: ReactNode;
  steps: {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    title: ReactNode;
    body: ReactNode;
  }[];
};

const ProgramPanel = ({
  header,
  eyebrow,
  steps,
  className,
  ...props
}: ProgramPanelProps) => (
  <TabPanel
    className={clsx(
      "mx-auto max-w-[70rem] divide-y divide-neutral-600/50 border border-neutral-600/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400",
      className,
    )}
    {...props}
  >
    <div className="flex flex-col gap-8 bg-[#1C1B2C] px-8 pb-16 pt-12 md:px-12">
      <span className="text-sm/normal tracking-[0.5rem]">{eyebrow}</span>
      <h2 className="text-4xl font-light md:text-5xl">{header}</h2>
    </div>
    <ol className="divide-y divide-neutral-600/50 bg-pythpurple-800">
      {steps.map(({ icon: Icon, title, body }, i) => (
        <li
          key={i}
          className="px-8 py-10 md:flex md:flex-row md:items-center md:gap-8 md:px-12"
        >
          <Icon className="hidden size-20 flex-none md:block" />
          <div className="flex flex-col gap-8 md:gap-6">
            <div className="flex flex-row items-center gap-4">
              <Icon className="size-16 flex-none md:hidden" />
              <div>
                <div className="text-sm/normal tracking-[0.5rem]">
                  STEP {i + 1}
                </div>
                <h3 className="text-3xl font-light">{title}</h3>
              </div>
            </div>
            <p>{body}</p>
          </div>
        </li>
      ))}
    </ol>
  </TabPanel>
);

enum TabId {
  IntegrityStaking = "integrity-staking",
  Governance = "governance",
}
