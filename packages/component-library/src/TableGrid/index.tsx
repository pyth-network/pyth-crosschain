import {
  AllCommunityModule,
  ClientSideRowModelModule,
  ModuleRegistry,
  TextFilterModule,
  themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {
  forwardRef,
  type ReactNode,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

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
    return <div className={styles.defaultCellContainer}><div className={styles.skeletonContainer}><Skeleton fill /></div></div>;
  }
  return <div className={styles.defaultCellContainer}>{props.value}</div>;
};

export const TableGrid = forwardRef(
  <TData extends Record<string, unknown>>(
    {
      rowData,
      colDefs,
      isLoading,
      cardProps,
      pagination,
      ...props
    }: TableGridProps<TData>,
    ref: React.Ref<AgGridReact<TData> | null>,
  ) => {
    const gridRef = useRef<AgGridReact<TData>>(null);
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    useImperativeHandle(ref, () => gridRef.current);

    const defaultColDef = useMemo(() => {
      return {
        cellRenderer: SkeletonCellRenderer,
        flex: 1,
      };
    }, []);

    const mappedColDefs = useMemo(() => {
      return colDefs.map((colDef) => {
        return {
          ...colDef,
          // the types in ag-grid are `any` for the cellRenderers
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          cellRenderer: isLoading
            ? (colDef.loadingCellRenderer ?? SkeletonCellRenderer)
            : colDef.cellRenderer,
        };
      });
    }, [colDefs, isLoading]);

    const onPaginationChanged = useCallback(() => {
      if (gridRef.current?.api) {
        const api = gridRef.current.api;
        setPageSize(api.paginationGetPageSize());
        setCurrentPage(api.paginationGetCurrentPage() + 1);
        setTotalPages(api.paginationGetTotalPages());
      }
    }, []);
    const onPageChange = useCallback((newPage: number) => {
      gridRef.current?.api.paginationGoToPage(newPage - 1);
    }, []);

    const tableGrid = (
      <AgGridReact<TData>
        className={styles.tableGrid}
        ref={gridRef}
        // @ts-expect-error empty row data
        rowData={isLoading ? [[]] : rowData}
        defaultColDef={defaultColDef}
        columnDefs={mappedColDefs}
        theme={themeQuartz}
        domLayout="autoHeight"
        pagination={pagination ?? false}
        paginationPageSize={pageSize}
        suppressPaginationPanel
        onPaginationChanged={onPaginationChanged}
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
  },
);

TableGrid.displayName = "TableGrid";
