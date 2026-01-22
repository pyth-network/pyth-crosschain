"use client";

import {
  AllCommunityModule,
  ClientSideRowModelModule,
  ModuleRegistry,
  TextFilterModule,
  themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import cx from "clsx";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { classes } from "./TableGrid.styles";
import type { TableGridProps } from "./types";

ModuleRegistry.registerModules([
  AllCommunityModule,
  TextFilterModule,
  ClientSideRowModelModule,
]);

const SkeletonCellRenderer = (props: { value?: ReactNode }) => {
  if (!props.value) {
    return (
      <div className={classes.defaultCellContainer}>
        <div className={classes.skeletonContainer}>
          <div className={classes.skeleton} />
        </div>
      </div>
    );
  }
  return <div className={classes.defaultCellContainer}>{props.value}</div>;
};

const DEFAULT_COL_DEF = {
  cellRenderer: SkeletonCellRenderer,
  flex: 1,
};

export function TableGrid<TData extends Record<string, unknown>>({
  rowData,
  columnDefs,
  loading,
  className,
  ...props
}: TableGridProps<TData>) {
  const mappedColDefs = useMemo(() => {
    return columnDefs.map((colDef) => ({
      ...colDef,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      cellRenderer: loading
        ? (colDef.loadingCellRenderer ?? SkeletonCellRenderer)
        : colDef.cellRenderer,
    }));
  }, [columnDefs, loading]);

  return (
    <AgGridReact<TData>
      className={cx(classes.tableGrid, className)}
      // @ts-expect-error empty row data for loading state
      rowData={loading ? [[]] : rowData}
      defaultColDef={DEFAULT_COL_DEF}
      columnDefs={mappedColDefs}
      theme={themeQuartz}
      domLayout="autoHeight"
      {...props}
    />
  );
}

export { type TableGridProps } from "./types";
