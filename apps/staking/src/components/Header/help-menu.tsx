"use client";

import {
  QuestionMarkCircleIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { useState, useCallback } from "react";
import { MenuTrigger, Button } from "react-aria-components";

import { GeneralFaq } from "../GeneralFaq";
import { GovernanceGuide } from "../GovernanceGuide";
import { Menu, MenuItem, Section, Separator } from "../Menu";
import { OracleIntegrityStakingGuide } from "../OracleIntegrityStakingGuide";
import { PublisherFaq } from "../PublisherFaq";

export const HelpMenu = () => {
  const [faqOpen, setFaqOpen] = useState(false);
  const openFaq = useCallback(() => {
    setFaqOpen(true);
  }, [setFaqOpen]);

  const [oisGuideOpen, setOisGuideOpen] = useState(false);
  const openOisGuide = useCallback(() => {
    setOisGuideOpen(true);
  }, [setOisGuideOpen]);

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
        <Button className="group -mx-2 flex flex-row items-center gap-2 p-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400">
          <QuestionMarkCircleIcon className="size-6 flex-none" />
          <span className="sr-only">Help</span>
          <ChevronDownIcon className="size-4 flex-none opacity-60 transition duration-300 group-data-[pressed]:-rotate-180" />
        </Button>
        <Menu placement="bottom end">
          <Section>
            <MenuItem onAction={openFaq}>FAQ</MenuItem>
          </Section>
          <Separator />
          <Section>
            <MenuItem onAction={openOisGuide}>
              Oracle Integrity Staking (OIS) Guide
            </MenuItem>
            <MenuItem onAction={openGovernanceGuide}>
              Pyth Governance Guide
            </MenuItem>
          </Section>
          <Separator />
          <Section>
            <MenuItem onAction={openPublisherFaq}>Data Publisher FAQ</MenuItem>
          </Section>
        </Menu>
      </MenuTrigger>
      <GeneralFaq isOpen={faqOpen} onOpenChange={setFaqOpen} />
      <OracleIntegrityStakingGuide
        isOpen={oisGuideOpen}
        onOpenChange={setOisGuideOpen}
      />
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
