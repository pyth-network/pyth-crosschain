import * as Icon from "@phosphor-icons/react/dist/ssr";
import type { ArgTypes } from "@storybook/react";

import { VARIANTS, SIZES } from "./index.js";

export const Category = {
  State: "State",
  Variant: "Variant",
  Contents: "Contents",
};

export const argTypes = {
  children: {
    control: "text",
    table: {
      category: Category.Contents,
    },
  },
  isDisabled: {
    control: "boolean",
    table: {
      category: Category.State,
    },
  },
  variant: {
    control: "inline-radio",
    options: VARIANTS,
    table: {
      category: Category.Variant,
    },
  },
  size: {
    control: "inline-radio",
    options: SIZES,
    table: {
      category: Category.Variant,
    },
  },
  rounded: {
    control: "boolean",
    table: {
      category: Category.Variant,
    },
  },
  beforeIcon: {
    control: "select",
    options: Object.keys(Icon),
    mapping: Icon,
    table: {
      category: Category.Contents,
    },
  },
  afterIcon: {
    control: "select",
    options: Object.keys(Icon),
    mapping: Icon,
    table: {
      category: Category.Contents,
    },
  },
} satisfies ArgTypes;
