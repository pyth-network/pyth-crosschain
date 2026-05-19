import { ListDashes } from "@phosphor-icons/react/dist/ssr/ListDashes";
import { Card } from "@pythnetwork/component-library/Card";
import { ErrorPage } from "@pythnetwork/component-library/ErrorPage";
import { NoResults } from "@pythnetwork/component-library/NoResults";
import { Suspense } from "react";
import { parseChainSlug } from "../../entropy-deployments";
import type { Args } from "../../requests";
import { getRequests, ResultType } from "../../requests";
import styles from "./index.module.scss";
import { Results as ResultsImpl, ResultsLoading } from "./results";
import {
  ChainSelect,
  Paginator as PaginatorImpl,
  SearchBar,
  StatusSelect,
} from "./search-controls";

type Props = {
  searchParams: Promise<Args>;
};

export const Home = (props: Props) => (
  <div className={styles.home}>
    <h1 className={styles.header}>Requests</h1>
    <div className={styles.body}>
      <Card
        footer={
          <Suspense>
            <Paginator {...props} />
          </Suspense>
        }
        icon={<ListDashes />}
        title="Request Log"
        toolbar={
          <>
            <ChainSelect
              hideLabel
              label="Chain"
              placement="bottom right"
              size="sm"
              variant="outline"
            />
            <StatusSelect
              className={styles.statusSelect ?? ""}
              defaultButtonLabel="Status"
              hideGroupLabel
              hideLabel
              label="Status"
              placement="bottom right"
              size="sm"
              variant="outline"
            />
            <SearchBar
              className={styles.searchBar ?? ""}
              placeholder="Sequence number, provider, sender or tx hash"
              size="sm"
            />
          </>
        }
      >
        <div className={styles.cardBody}>
          <Suspense fallback={<ResultsLoading />}>
            <Results {...props} />
          </Suspense>
        </div>
      </Card>
    </div>
  </div>
);

const Results = async (props: Props) => {
  try {
    const searchParams = await props.searchParams;
    const results = await getRequests(searchParams);
    switch (results.type) {
      case ResultType.BadSearch: {
        return (
          <NoResults
            body="Your search query is not a valid transaction hash, sequence number, or sender."
            header="Invalid Search"
            query={results.search}
          />
        );
      }
      case ResultType.ErrorResult: {
        return <ErrorPage error={results.error} />;
      }
      case ResultType.Success: {
        return (
          <ResultsImpl
            chain={parseChainSlug(searchParams.chain)}
            currentPage={results.currentPage}
            key={[
              searchParams.chain,
              searchParams.search,
              searchParams.status,
            ].join(",")}
            now={new Date()}
            search={searchParams.search}
          />
        );
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      return <ErrorPage error={error} />;
    } else {
      const err = new Error("Unknown Error");
      err.cause = error;
      return <ErrorPage error={err} />;
    }
  }
};

const Paginator = async (props: Props) => {
  try {
    const searchParams = await props.searchParams;
    const results = await getRequests(searchParams);
    switch (results.type) {
      case ResultType.Success: {
        return <PaginatorImpl numPages={results.numPages} />;
      }
      case ResultType.BadSearch: {
        return <PaginatorImpl numPages={0} />;
      }
      case ResultType.ErrorResult: {
        return <></>;
      }
    }
  } catch {
    return <></>;
  }
};
