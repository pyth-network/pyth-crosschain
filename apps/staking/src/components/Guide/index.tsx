import type { StaticImageData } from "next/image";
import Image from "next/image";
import type {
  ComponentProps,
  ComponentType,
  ReactNode,
  SVGAttributes,
} from "react";
import { useMemo, useRef } from "react";
import {
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Collection,
} from "react-aria-components";

import { Faq } from "../Faq";
import { ModalDialog } from "../ModalDialog";

type Props = Omit<ComponentProps<typeof ModalDialog>, "title" | "children"> & {
  title: ReactNode;
  description: ReactNode;
  steps: {
    title: string;
    icon: ComponentType<SVGAttributes<SVGSVGElement>>;
    description: ReactNode;
    subTabs: {
      title: string;
      description: ReactNode;
      image: StaticImageData;
    }[];
    faq: ComponentProps<typeof Faq>;
  }[];
};

export const Guide = ({ title, description, steps, ...props }: Props) => {
  const stepsWithIndices = useMemo(
    () =>
      steps.map(({ subTabs, ...step }, index) => ({
        ...step,
        subTabs: subTabs.map((subTab, subtabIndex) => ({
          index: subtabIndex,
          ...subTab,
        })),
        index,
      })),
    [steps],
  );
  const scrollTarget = useRef<HTMLDivElement | null>(null);

  return (
    <ModalDialog title={title} {...props}>
      <div className="mb-6 max-w-prose opacity-60 md:mb-12">{description}</div>
      <Tabs className="lg:bg-black/40">
        <div ref={scrollTarget} />
        <TabList
          items={stepsWithIndices}
          className="top-[calc(-1_*_(2rem_+_1px))] z-10 flex flex-col bg-[#100E21] xs:top-[calc(-1_*_(4rem_+_1px))] sm:top-[calc(-1_*_(8rem_+_1px))] md:sticky md:flex-row lg:flex-row"
        >
          {({ title, icon: Icon, index }) => (
            <Tab
              id={index.toString()}
              className="group flex cursor-pointer flex-row items-center gap-4 border border-neutral-600/50 px-6 py-4 transition data-[selected]:cursor-default data-[selected]:border-pythpurple-600 data-[selected]:bg-pythpurple-600/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400 md:flex-1 md:px-4 md:py-2 lg:border-b lg:border-x-transparent lg:border-t-transparent lg:bg-black/40 lg:px-4 lg:py-6 lg:data-[selected]:border-neutral-600/50 lg:data-[selected]:border-b-transparent lg:data-[selected]:bg-black/40 xl:px-10 2xl:px-20"
            >
              <Icon className="size-10 flex-none opacity-50 transition group-data-[selected]:opacity-100" />
              <div className="flex flex-col justify-between">
                <div className="text-sm tracking-[0.5rem] opacity-50 md:tracking-wide">
                  STEP {index + 1}
                </div>
                <div className="opacity-50 transition group-data-[selected]:opacity-100 xl:text-xl">
                  {title}
                </div>
              </div>
            </Tab>
          )}
        </TabList>
        <Collection items={stepsWithIndices}>
          {({ faq, index, title, description, subTabs }) => (
            <TabPanel
              id={index.toString()}
              className="border-neutral-600/50 lg:border lg:border-t-0 lg:p-16 lg:pt-8"
            >
              <div className="px-2 py-10">
                <h2 className="mb-6 text-3xl font-light">{title}</h2>
                <div className="flex max-w-prose flex-col gap-4 opacity-60">
                  {description}
                </div>
              </div>
              <Tabs
                defaultSelectedKey={subTabs[0]?.index.toString() ?? ""}
                className="mb-20 px-6"
              >
                <TabList items={subTabs} className="flex flex-col sm:flex-row">
                  {({ title, index: subtabIndex }) => (
                    <Tab
                      id={subtabIndex.toString()}
                      className="grid cursor-pointer place-content-center border border-neutral-600/50 p-2 text-center opacity-60 transition data-[selected]:cursor-default data-[selected]:border-pythpurple-600/50 data-[selected]:bg-pythpurple-600/10 data-[selected]:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400 sm:h-20 sm:flex-1 sm:px-2 sm:py-4 md:px-4"
                    >
                      {title}
                    </Tab>
                  )}
                </TabList>
                <Collection items={subTabs}>
                  {({ title, description, image, index: subtabIndex }) => (
                    <TabPanel
                      id={subtabIndex.toString()}
                      className="my-10 flex flex-col gap-10 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400 md:flex-row-reverse md:items-center"
                    >
                      <div className="grow">
                        <h3 className="mb-4 text-xl font-bold">{title}</h3>
                        <div className="flex max-w-prose flex-col gap-4 opacity-60">
                          {description}
                        </div>
                      </div>
                      <Image
                        src={image}
                        alt=""
                        className="w-full flex-none border border-neutral-600/50 md:w-80 lg:w-[25rem] xl:w-[40rem]"
                        placeholder="blur"
                      />
                    </TabPanel>
                  )}
                </Collection>
              </Tabs>
              <Faq {...faq} className="px-2" />
            </TabPanel>
          )}
        </Collection>
      </Tabs>
    </ModalDialog>
  );
};
