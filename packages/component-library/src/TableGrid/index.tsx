import {
  AllCommunityModule,
  ClientSideRowModelModule,
  ModuleRegistry,
  TextFilterModule,
  themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";

import { Card } from "../Card";
import { Paginator } from "../Paginator";
import { Skeleton } from "../Skeleton";
import styles from "./index.module.scss";
import type { TableGridProps } from "./table-grid-props";

// Register all Community features
ModuleRegistry.registerModules([
  AllCommunityModule,
  TextFilterModule,
  ClientSideRowModelModule,
]);

const SkeletonCellRenderer = (props: { value?: ReactNode }) => {
  if (!props.value) {
    return (
      <div className={styles.defaultCellContainer}>
        <div className={styles.skeletonContainer}>
          <Skeleton fill />
        </div>
      </div>
    );
  }
  return <div className={styles.defaultCellContainer}>{props.value}</div>;
};

const DEFAULT_COL_DEF = {
  cellRenderer: SkeletonCellRenderer,
  flex: 1,
};

export const TableGrid = <TData extends Record<string, unknown>>({
  rowData,
  columnDefs,
  loading,
  cardProps,
  pagination,
  ...props
}: TableGridProps<TData>) => {
  const gridRef = useRef<AgGridReact<TData>>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const mappedColDefs = useMemo(() => {
    return columnDefs.map((colDef) => {
      return {
        ...colDef,
        // the types in ag-grid are `any` for the cellRenderers which is throwing an error here
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        cellRenderer: loading
          ? (colDef.loadingCellRenderer ?? SkeletonCellRenderer)
          : colDef.cellRenderer,
      };
    });
  }, [columnDefs, loading]);

  const onPaginationChanged = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    setPageSize(api.paginationGetPageSize());
    setCurrentPage(api.paginationGetCurrentPage() + 1);
    setTotalPages(api.paginationGetTotalPages());
  }, []);

  const onPageChange = useCallback((newPage: number) => {
    gridRef.current?.api.paginationGoToPage(newPage - 1);
  }, []);

  const tableGrid = (
    <AgGridReact<TData>
      className={styles.tableGrid}
      // @ts-expect-error empty row data, which is throwing an error here btu required to display 1 row in the loading state
      rowData={loading ? [[]] : rowData}
      defaultColDef={DEFAULT_COL_DEF}
      columnDefs={mappedColDefs}
      theme={themeQuartz}
      domLayout="autoHeight"
      pagination={pagination ?? false}
      paginationPageSize={pageSize}
      suppressPaginationPanel
      onPaginationChanged={onPaginationChanged}
      ref={gridRef}
      {...props}
    />
  );
  if (!cardProps && !pagination) {
    return tableGrid;
  }
  return (
    <Card
      footer={
        pagination && (
          <Paginator
            numPages={totalPages}
            currentPage={currentPage}
            onPageChange={onPageChange}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        )
      }
      {...cardProps}
    >
      {tableGrid}
    </Card>
  );
};
