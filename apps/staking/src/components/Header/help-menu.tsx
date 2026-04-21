"use client";

import {
  ChevronDownIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useState } from "react";
import { Button, MenuTrigger } from "react-aria-components";

import { GovernanceGuide } from "../GovernanceGuide";
import { Menu, MenuItem, Section, Separator } from "../Menu";
import { PublisherFaq } from "../PublisherFaq";

export const HelpMenu = () => {
  const [governanceGuideOpen, setGovernanceGuideOpen] = useState(false);
  const openGovernanceGuide = useCallback(() => {
    setGovernanceGuideOpen(true);
  }, [setGovernanceGuideOpen]);

  const [publisherFaqOpen, setPublisherFaqOpen] = useState(false);
  const openPublisherFaq = useCallback(() => {
    setPublisherFaqOpen(true);
  }, [setPublisherFaqOpen]);

  return (
    <>
      <MenuTrigger>
        <Button className="group -mx-2 flex flex-row items-center gap-2 rounded-sm p-2 transition hover:bg-white/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400 pressed:bg-white/10 xl:-mx-4 xl:px-4">
          <QuestionMarkCircleIcon className="size-6 flex-none" />
          <span className="sr-only xl:not-sr-only">Help</span>
          <ChevronDownIcon className="size-4 flex-none opacity-60 transition duration-300 group-data-[pressed]:-rotate-180" />
        </Button>
        <Menu placement="bottom end">
          <Section>
            <MenuItem onAction={openGovernanceGuide}>
              Pyth Governance Guide
            </MenuItem>
          </Section>
          <Separator />
          <Section>
            <MenuItem onAction={openPublisherFaq}>Data Publisher FAQ</MenuItem>
            <MenuItem
              href="https://pyth-network.notion.site/Oracle-Integrity-Staking-OIS-Guide-for-Pyth-Network-MDPs-2755c872a7c44aefabfa9987ba7ec8ae"
              target="_blank"
            >
              Data Publisher Guide
            </MenuItem>
          </Section>
        </Menu>
      </MenuTrigger>
      <GovernanceGuide
        isOpen={governanceGuideOpen}
        onOpenChange={setGovernanceGuideOpen}
      />
      <PublisherFaq
        isOpen={publisherFaqOpen}
        onOpenChange={setPublisherFaqOpen}
      />
    </>
  );
};
