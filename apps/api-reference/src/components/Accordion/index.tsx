import { Disclosure, DisclosurePanel } from "@headlessui/react";
import { LazyMotion, AnimatePresence, m, domAnimation } from "framer-motion";
import type { ComponentProps, Ref } from "react";
import { forwardRef } from "react";

export { DisclosureButton as AccordionButton } from "@headlessui/react";

export const Accordion = (props: Parameters<typeof Disclosure>[0]) => (
  <LazyMotion features={domAnimation}>
    <Disclosure as="div" {...props} />
  </LazyMotion>
);

const AccordionPanelImpl = (
  { style, ...props }: ComponentProps<typeof m.div>,
  ref: Ref<HTMLDivElement>,
) => (
  <DisclosurePanel static ref={ref} style={{ display: "contents" }}>
    {({ open }) => (
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            style={{ ...style, overflow: "hidden" }}
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            {...props}
          />
        )}
      </AnimatePresence>
    )}
  </DisclosurePanel>
);

export const AccordionPanel = forwardRef(AccordionPanelImpl);
