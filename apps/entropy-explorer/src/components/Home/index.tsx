import { ListDashes } from "@phosphor-icons/react/dist/ssr/ListDashes";
import { Card } from "@pythnetwork/component-library/Card";
import { ErrorPage } from "@pythnetwork/component-library/ErrorPage";
import { NoResults } from "@pythnetwork/component-library/NoResults";
import { Suspense } from "react";

import styles from "./index.module.scss";
import { Results as ResultsImpl, ResultsLoading } from "./results";
import {
  SearchBar,
  Paginator as PaginatorImpl,
  ChainSelect,
  StatusSelect,
} from "./search-controls";
import { parseChainSlug } from "../../entropy-deployments";
import type { Args } from "../../requests";
import { getRequests, ResultType } from "../../requests";

type Props = {
  searchParams: Promise<Args>;
};

export const Home = (props: Props) => (
  <div className={styles.home}>
    <h1 className={styles.header}>Requests</h1>
    <div className={styles.body}>
      <Card
        title="Request Log"
        icon={<ListDashes />}
        toolbar={
          <>
            <ChainSelect
              label="Chain"
              hideLabel
              variant="outline"
              size="sm"
              placement="bottom right"
            />
            <StatusSelect
              label="Status"
              hideLabel
              defaultButtonLabel="Status"
              hideGroupLabel
              variant="outline"
              size="sm"
              placement="bottom right"
              className={styles.statusSelect ?? ""}
            />
            <SearchBar
              size="sm"
              placeholder="Sequence number, provider, sender or tx hash"
              className={styles.searchBar ?? ""}
            />
          </>
        }
        footer={
          <Suspense>
            <Paginator {...props} />
          </Suspense>
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
            header="Invalid Search"
            body="Your search query is not a valid transaction hash, sequence number, or sender."
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
            key={[
              searchParams.chain,
              searchParams.search,
              searchParams.status,
            ].join(",")}
            chain={parseChainSlug(searchParams.chain)}
            search={searchParams.search}
            currentPage={results.currentPage}
            now={new Date()}
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
