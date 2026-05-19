import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import clsx from "clsx";
import type { ComponentProps } from "react";
import { useCallback, useMemo } from "react";
import type { Link } from "react-aria-components";
import type { Props as ButtonProps } from "../Button/index.jsx";
import { Button } from "../Button/index.jsx";
import buttonStyles from "../Button/index.module.scss";
import { Select } from "../Select/index.jsx";
import { Spinner } from "../Spinner/index.jsx";
import { Toolbar } from "../unstyled/Toolbar/index.jsx";
import styles from "./index.module.scss";

type Props = {
  numPages: number;
  currentPage: number;
  onPageChange: (newPage: number) => void;
  isPageTransitioning?: boolean | undefined;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageSizeChange: (newPageSize: number) => void;
  isPageSizeTransitioning?: boolean | undefined;
  mkPageLink?: ((page: number) => string) | undefined;
  className?: string | undefined;
};

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

export const Paginator = ({
  numPages,
  currentPage,
  isPageTransitioning,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  isPageSizeTransitioning,
  mkPageLink,
  className,
}: Props) => (
  <div className={clsx(styles.paginator, className)}>
    <PageSizeSelect
      isPending={isPageSizeTransitioning}
      onPageSizeChange={onPageSizeChange}
      pageSize={pageSize}
      pageSizeOptions={pageSizeOptions}
    />
    {numPages > 1 && (
      <PaginatorToolbar
        currentPage={currentPage}
        isPending={isPageTransitioning}
        mkPageLink={mkPageLink}
        numPages={numPages}
        onPageChange={onPageChange}
      />
    )}
  </div>
);

type PageSizeSelectProps = {
  pageSize: number;
  pageSizeOptions: number[];
  onPageSizeChange: (newPageSize: number) => void;
  isPending?: boolean | undefined;
};

const PageSizeSelect = ({
  pageSize,
  onPageSizeChange,
  pageSizeOptions,
  isPending,
}: PageSizeSelectProps) => (
  <Select
    className={styles.pageSizeSelect ?? ""}
    hideLabel
    isPending={isPending ?? false}
    label="Page size"
    onSelectionChange={onPageSizeChange}
    options={pageSizeOptions.map((option) => ({ id: option }))}
    selectedKey={pageSize}
    show={(value) => `${value.id.toString()} per page`}
    size="sm"
    variant="ghost"
  />
);

type PaginatorProps = {
  numPages: number;
  currentPage: number;
  onPageChange: (newPage: number) => void;
  mkPageLink: ((page: number) => string) | undefined;
  isPending?: boolean | undefined;
};

const PaginatorToolbar = ({
  numPages,
  currentPage,
  onPageChange,
  mkPageLink,
  isPending,
}: PaginatorProps) => {
  const first = useMemo(
    () =>
      currentPage <= 3 || numPages <= 5
        ? 1
        : currentPage - 2 - Math.max(2 - (numPages - currentPage), 0),
    [currentPage, numPages],
  );

  const pages = useMemo(
    () =>
      Array.from({ length: Math.min(numPages - first + 1, 5) })
        .fill(undefined)
        .map((_, i) => i + first),
    [numPages, first],
  );

  return (
    <Toolbar aria-label="Page" className={styles.paginatorToolbar ?? ""}>
      {isPending && (
        <Spinner
          className={styles.spinner ?? ""}
          isIndeterminate
          label="Loading page..."
        />
      )}
      <PageSelector
        beforeIcon={<CaretLeft />}
        hideText
        isDisabled={currentPage === 1}
        mkPageLink={mkPageLink}
        onPageChange={onPageChange}
        page={1}
      >
        First Page
      </PageSelector>
      {pages.map((page) => {
        return page === currentPage ? (
          <SelectedPage key={page}>{page.toString()}</SelectedPage>
        ) : (
          <PageSelector
            aria-label={`Page ${page.toString()}`}
            key={page}
            mkPageLink={mkPageLink}
            onPageChange={onPageChange}
            page={page}
          >
            {page.toString()}
          </PageSelector>
        );
      })}
      <PageSelector
        beforeIcon={<CaretRight />}
        hideText
        isDisabled={currentPage === numPages}
        mkPageLink={mkPageLink}
        onPageChange={onPageChange}
        page={numPages}
      >
        Last Page
      </PageSelector>
    </Toolbar>
  );
};

type PageSelectorProps = Pick<
  ComponentProps<typeof Button>,
  "hideText" | "beforeIcon" | "isDisabled" | "children"
> & {
  page: number;
  onPageChange: (newPage: number) => void;
  mkPageLink: ((page: number) => string) | undefined;
};

const PageSelector = ({ mkPageLink, ...props }: PageSelectorProps) =>
  mkPageLink ? (
    <PageLink mkPageLink={mkPageLink} {...props} />
  ) : (
    <PageButton {...props} />
  );

type PageLinkProps = Omit<
  ButtonProps<typeof Link>,
  "variant" | "size" | "href" | "onPress"
> & {
  page: number;
  onPageChange: (newPage: number) => void;
  mkPageLink: (page: number) => string;
};

const PageLink = ({
  page,
  isDisabled,
  onPageChange,
  mkPageLink,
  ...props
}: PageLinkProps) => {
  const url = useMemo(() => mkPageLink(page), [page, mkPageLink]);
  const onPress = useCallback(() => {
    onPageChange(page);
  }, [onPageChange, page]);

  return (
    <Button
      href={url}
      isDisabled={isDisabled === true}
      onPress={onPress}
      size="sm"
      variant="ghost"
      {...props}
    />
  );
};

type PageButtonProps = Omit<
  ButtonProps<typeof Link>,
  "variant" | "size" | "href" | "onPress"
> & {
  page: number;
  onPageChange: (newPage: number) => void;
};

const PageButton = ({
  page,
  isDisabled,
  onPageChange,
  ...props
}: PageButtonProps) => {
  const onPress = useCallback(() => {
    onPageChange(page);
  }, [onPageChange, page]);

  return (
    <Button
      isDisabled={isDisabled === true}
      onPress={onPress}
      size="sm"
      variant="ghost"
      {...props}
    />
  );
};

const SelectedPage = ({ children }: { children: string }) => (
  <div
    className={clsx(buttonStyles.button, styles.selectedPage)}
    data-pressed
    data-size="sm"
    data-variant="ghost"
    key={children}
  >
    <span className={buttonStyles.text}>{children}</span>
  </div>
);
