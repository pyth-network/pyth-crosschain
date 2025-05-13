"use client";

import type { Props as SelectProps } from "@pythnetwork/component-library/Select";
import { Select } from "@pythnetwork/component-library/Select";
import type { ComponentProps } from "react";
import { Suspense, useCallback, useMemo } from "react";

import { useQuery } from "./use-query";
import { Status } from "../../requests";
import type { ConstrainedOmit } from "../../type-utils";
import { Status as StatusComponent } from "../Status";

export const StatusSelect = (
  props: ComponentProps<typeof ResolvedStatusSelect>,
) => (
  <Suspense
    fallback={
      <Select
        {...defaultProps}
        {...props}
        isPending
        options={[]}
        defaultSelectedKey={undefined}
      />
    }
  >
    <ResolvedStatusSelect {...props} />
  </Suspense>
);

const ResolvedStatusSelect = (
  props: ConstrainedOmit<
    SelectProps<
      ReturnType<
        typeof useResolvedProps
      >["optionGroups"][number]["options"][number]
    >,
    keyof typeof defaultProps | keyof ReturnType<typeof useResolvedProps>
  >,
) => {
  const resolvedProps = useResolvedProps();

  return <Select {...defaultProps} {...resolvedProps} {...props} />;
};

const useResolvedProps = () => {
  const { status, setStatus } = useQuery();
  const chains = useMemo(
    () => [
      {
        name: "All",
        options: [{ id: "all" as const }],
      },
      {
        name: "Statuses",
        options: [
          { id: Status.Complete },
          { id: Status.Pending },
          { id: Status.CallbackError },
        ],
      },
    ],
    [],
  );

  const showStatus = useCallback(
    (status: (typeof chains)[number]["options"][number]) =>
      status.id === "all" ? (
        "All"
      ) : (
        <StatusComponent size="xs" status={status.id} />
      ),
    [],
  );

  return {
    selectedKey: status ?? ("all" as const),
    onSelectionChange: setStatus,
    optionGroups: chains,
    show: showStatus,
    buttonLabel:
      status === null ? (
        "Status"
      ) : (
        <StatusComponent size="xs" status={status} />
      ),
  };
};

const defaultProps = {
  label: "Status",
  hideLabel: true,
  defaultButtonLabel: "Status",
  hideGroupLabel: true,
} as const;
