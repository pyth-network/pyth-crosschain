import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { CircleNotch } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import clsx from "clsx";
import {
  type ComponentProps,
  useTransition,
  useMemo,
  useCallback,
} from "react";

import styles from "./index.module.scss";
import { Button, ButtonLink } from "../Button/index.js";
import buttonStyles from "../Button/index.module.scss";
import { Select } from "../Select/index.js";
import { UnstyledToolbar } from "../UnstyledToolbar/index.js";

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
}: PageSizeSelectProps) => {
  const [isTransitioning, startTransition] = useTransition();

  const onChange = useCallback(
    (newPageSize: number) => {
      startTransition(() => {
        onPageSizeChange(newPageSize);
      });
    },
    [startTransition, onPageSizeChange],
  );

  return (
    <div className={styles.pageSizeSelect}>
      <Select
        label="Page size"
        hideLabel
        options={pageSizeOptions}
        selectedKey={pageSize}
        onSelectionChange={onChange}
        show={(value) => `${value.toString()} per page`}
        variant="ghost"
        size="sm"
      />
      <CircleNotch
        className={clsx(styles.loadingIndicator, {
          [styles.visible ?? ""]: isTransitioning,
        })}
      />
    </div>
  );
};

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
    <UnstyledToolbar
      aria-label="Page"
      className={styles.paginatorToolbar ?? ""}
    >
      <PageSelector
        hideText
        // I'm not quite sure why this is triggering, I'll need to figure this
        // out later.  Something in Phosphor's types is incorrect and is making
        // eslint think this icon is an error object somehow...
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        beforeIcon={CaretLeft}
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
        // I'm not quite sure why this is triggering, I'll need to figure this
        // out later.  Something in Phosphor's types is incorrect and is making
        // eslint think this icon is an error object somehow...
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        beforeIcon={CaretRight}
        isDisabled={currentPage === numPages}
        page={numPages}
        onPageChange={onPageChange}
        mkPageLink={mkPageLink}
      >
        Last Page
      </PageSelector>
    </UnstyledToolbar>
  );
};

type PageSelectorProps = Pick<
  ComponentProps<typeof ButtonLink>,
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
  ComponentProps<typeof ButtonLink>,
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
  const [isTransitioning, startTransition] = useTransition();

  const url = useMemo(() => mkPageLink(page), [page, mkPageLink]);
  const onPress = useCallback(() => {
    startTransition(() => {
      onPageChange(page);
    });
  }, [onPageChange, page]);

  return (
    <ButtonLink
      variant="ghost"
      size="sm"
      onPress={onPress}
      href={url}
      isDisabled={isDisabled === true || isTransitioning}
      {...props}
    />
  );
};

type PageButtonProps = Omit<
  ComponentProps<typeof Button>,
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
  const [isTransitioning, startTransition] = useTransition();

  const onPress = useCallback(() => {
    startTransition(() => {
      onPageChange(page);
    });
  }, [onPageChange, page]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onPress={onPress}
      isDisabled={isDisabled === true || isTransitioning}
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
