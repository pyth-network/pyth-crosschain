import {
  CaretLeft,
  CaretRight,
  CircleNotch,
} from "@phosphor-icons/react/dist/ssr";
import { ButtonLink } from "@pythnetwork/component-library/Button";
import { Select } from "@pythnetwork/component-library/Select";
import { UnstyledToolbar } from "@pythnetwork/component-library/UnstyledToolbar";
import {
  type ComponentProps,
  useTransition,
  useMemo,
  useCallback,
} from "react";

type Props = {
  numPages: number;
  currentPage: number;
  setCurrentPage: (newPage: number) => void;
  pageSize: number;
  setPageSize: (newPageSize: number) => void;
  mkPageLink: (page: number) => string;
};

export const Paginator = ({
  numPages,
  currentPage,
  pageSize,
  setCurrentPage,
  setPageSize,
  mkPageLink,
}: Props) => (
  <div className="flex flex-row justify-between p-4">
    <PageSizeSelect pageSize={pageSize} setPageSize={setPageSize} />
    {numPages > 1 && (
      <PaginatorToolbar
        currentPage={currentPage}
        numPages={numPages}
        setCurrentPage={setCurrentPage}
        mkPageLink={mkPageLink}
      />
    )}
  </div>
);

type PageSizeSelectProps = {
  pageSize: number;
  setPageSize: (newPageSize: number) => void;
};

const PageSizeSelect = ({ pageSize, setPageSize }: PageSizeSelectProps) => {
  const [isTransitioning, startTransition] = useTransition();

  const onChange = useCallback(
    (newPageSize: number) => {
      startTransition(() => {
        setPageSize(newPageSize);
      });
    },
    [startTransition, setPageSize],
  );

  return (
    <div className="flex flex-row items-center gap-1">
      <Select
        label="Page size"
        hideLabel
        options={[10, 20, 50, 100] as const}
        selectedKey={pageSize}
        onSelectionChange={onChange}
        show={(value) => `${value.toString()} per page`}
        variant="ghost"
        size="xs"
      />
      {isTransitioning && <CircleNotch className="size-4 animate-spin" />}
    </div>
  );
};

type PaginatorProps = {
  numPages: number;
  currentPage: number;
  setCurrentPage: (newPage: number) => void;
  mkPageLink: (page: number) => string;
};

const PaginatorToolbar = ({
  numPages,
  currentPage,
  setCurrentPage,
  mkPageLink,
}: PaginatorProps) => {
  const first =
    currentPage <= 3 || numPages <= 5
      ? 1
      : currentPage - 2 - Math.max(2 - (numPages - currentPage), 0);
  const pages = Array.from({ length: Math.min(numPages - first + 1, 5) })
    .fill(undefined)
    .map((_, i) => i + first);

  return (
    <UnstyledToolbar aria-label="Page" className="flex flex-row gap-1">
      <PageLink
        hideText
        beforeIcon={CaretLeft}
        isDisabled={currentPage === 1}
        page={1}
        setCurrentPage={setCurrentPage}
        mkPageLink={mkPageLink}
      >
        First Page
      </PageLink>
      {pages.map((page) => {
        return page === currentPage ? (
          <SelectedPage key={page}>{page.toString()}</SelectedPage>
        ) : (
          <PageLink
            key={page}
            page={page}
            aria-label={`Page ${page.toString()}`}
            setCurrentPage={setCurrentPage}
            mkPageLink={mkPageLink}
          >
            {page.toString()}
          </PageLink>
        );
      })}
      <PageLink
        hideText
        beforeIcon={CaretRight}
        isDisabled={currentPage === numPages}
        page={numPages}
        setCurrentPage={setCurrentPage}
        mkPageLink={mkPageLink}
      >
        Last Page
      </PageLink>
    </UnstyledToolbar>
  );
};

type PageLinkProps = Omit<
  ComponentProps<typeof ButtonLink>,
  "variant" | "size" | "href" | "onPress"
> & {
  page: number;
  setCurrentPage: (newPage: number) => void;
  mkPageLink: (page: number) => string;
};

const PageLink = ({
  page,
  isDisabled,
  setCurrentPage,
  mkPageLink,
  ...props
}: PageLinkProps) => {
  const [isTransitioning, startTransition] = useTransition();

  const url = useMemo(() => mkPageLink(page), [page, mkPageLink]);
  const onPress = useCallback(() => {
    startTransition(() => {
      setCurrentPage(page);
    });
  }, [setCurrentPage, page]);

  return (
    <ButtonLink
      variant="ghost"
      size="xs"
      onPress={onPress}
      href={url}
      isDisabled={isDisabled === true || isTransitioning}
      {...props}
    />
  );
};

const SelectedPage = ({ children }: { children: string }) => (
  <div
    className="inline-block h-6 rounded-md bg-black/10 px-button-padding-xs text-[0.6875rem] font-medium leading-6 text-stone-900 dark:bg-white/10 dark:text-steel-50"
    key={children}
  >
    <span className="px-1">{children}</span>
  </div>
);
