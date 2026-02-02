"use client";

import { useEffect, useState } from "react";

import {
  FIELDS_WITHOUT_SPECS,
  SCROLL_DELAY_AFTER_EXPAND,
  SCROLL_DELAY_IMMEDIATE,
} from "../PropertyCard/constants";

export function PropertyFieldLinker() {
  const [expandedProperty, setExpandedProperty] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    const handlePropertyClick = (event: CustomEvent<string>) => {
      const propertyName = event.detail;
      setExpandedProperty(propertyName);

      if ((FIELDS_WITHOUT_SPECS as readonly string[]).includes(propertyName)) {
        return;
      }

      const propertyId = `property-${propertyName}`;
      const element = document.querySelector<HTMLDivElement>(`#${propertyId}`);

      if (element) {
        const accordionButton = element.querySelector<HTMLButtonElement>(
          "button[data-radix-collection-item], button[aria-expanded], button[data-state]",
        );

        if (accordionButton) {
          const isExpanded =
            accordionButton.getAttribute("aria-expanded") === "true" ||
            accordionButton.dataset.state === "open";
          if (isExpanded) {
            setTimeout(() => {
              element.scrollIntoView({ behavior: "smooth", block: "start" });
            }, SCROLL_DELAY_IMMEDIATE);
          } else {
            accordionButton.click();
            setTimeout(() => {
              element.scrollIntoView({ behavior: "smooth", block: "start" });
            }, SCROLL_DELAY_AFTER_EXPAND);
          }
        } else {
          setTimeout(() => {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }, SCROLL_DELAY_IMMEDIATE);
        }
      }
    };

    const eventName = "propertyFieldClick" as keyof WindowEventMap;
    globalThis.addEventListener(
      eventName,
      handlePropertyClick as EventListener,
    );

    return () => {
      globalThis.removeEventListener(
        eventName,
        handlePropertyClick as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (expandedProperty) {
      const event = new CustomEvent("expandProperty", {
        detail: expandedProperty,
      });
      globalThis.dispatchEvent(event);
    }
  }, [expandedProperty]);

  return;
}
