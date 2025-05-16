import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import clsx from "clsx";
import type { ComponentProps } from "react";
import { useMemo, useCallback } from "react";
import type { Link } from "react-aria-components";

import styles from "./index.module.scss";
import type { Props as ButtonProps } from "../Button/index.jsx";
import { Button } from "../Button/index.jsx";
import buttonStyles from "../Button/index.module.scss";
import { Select } from "../Select/index.jsx";
import { Toolbar } from "../unstyled/Toolbar/index.jsx";

type Props = {
  numPages: number;
  currentPage: number;
  onPageChange: (newPage: number) => void;
  pageSize: number;
  pageSizeOptions: number[];
  onPageSizeChange: (newPageSize: number) => void;
  mkPageLink?: ((page: number) => string) | undefined;
  className?: string | undefined;
};

export const Paginator = ({
  numPages,
  currentPage,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  mkPageLink,
  className,
}: Props) => (
  <div className={clsx(styles.paginator, className)}>
    <PageSizeSelect
      pageSize={pageSize}
      pageSizeOptions={pageSizeOptions}
      onPageSizeChange={onPageSizeChange}
    />
    {numPages > 1 && (
      <PaginatorToolbar
        currentPage={currentPage}
        numPages={numPages}
        onPageChange={onPageChange}
        mkPageLink={mkPageLink}
      />
    )}
  </div>
);

type PageSizeSelectProps = {
  pageSize: number;
  pageSizeOptions: number[];
  onPageSizeChange: (newPageSize: number) => void;
};

const PageSizeSelect = ({
  pageSize,
  onPageSizeChange,
  pageSizeOptions,
}: PageSizeSelectProps) => (
  <Select
    className={styles.pageSizeSelect ?? ""}
    label="Page size"
    hideLabel
    options={pageSizeOptions.map((option) => ({ id: option }))}
    selectedKey={pageSize}
    onSelectionChange={onPageSizeChange}
    show={(value) => `${value.id.toString()} per page`}
    variant="ghost"
    size="sm"
  />
);

type PaginatorProps = {
  numPages: number;
  currentPage: number;
  onPageChange: (newPage: number) => void;
  mkPageLink: ((page: number) => string) | undefined;
};

const PaginatorToolbar = ({
  numPages,
  currentPage,
  onPageChange,
  mkPageLink,
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
      <PageSelector
        hideText
        beforeIcon={<CaretLeft />}
        isDisabled={currentPage === 1}
        page={1}
        onPageChange={onPageChange}
        mkPageLink={mkPageLink}
      >
        First Page
      </PageSelector>
      {pages.map((page) => {
        return page === currentPage ? (
          <SelectedPage key={page}>{page.toString()}</SelectedPage>
        ) : (
          <PageSelector
            key={page}
            page={page}
            aria-label={`Page ${page.toString()}`}
            onPageChange={onPageChange}
            mkPageLink={mkPageLink}
          >
            {page.toString()}
          </PageSelector>
        );
      })}
      <PageSelector
        hideText
        beforeIcon={<CaretRight />}
        isDisabled={currentPage === numPages}
        page={numPages}
        onPageChange={onPageChange}
        mkPageLink={mkPageLink}
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
      variant="ghost"
      size="sm"
      onPress={onPress}
      href={url}
      isDisabled={isDisabled === true}
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
      variant="ghost"
      size="sm"
      onPress={onPress}
      isDisabled={isDisabled === true}
      {...props}
    />
  );
};

const SelectedPage = ({ children }: { children: string }) => (
  <div
    className={clsx(buttonStyles.button, styles.selectedPage)}
    data-size="sm"
    data-variant="ghost"
    data-pressed
    key={children}
  >
    <span className={buttonStyles.text}>{children}</span>
  </div>
);
