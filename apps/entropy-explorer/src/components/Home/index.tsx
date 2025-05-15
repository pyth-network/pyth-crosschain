import { ListDashes } from "@phosphor-icons/react/dist/ssr/ListDashes";
import { Card } from "@pythnetwork/component-library/Card";

import { ChainSelect } from "./chain-select";
import styles from "./index.module.scss";
import { Results } from "./results";
import { SearchBar } from "./search-bar";
import { StatusSelect } from "./status-select";

export const Home = () => (
  <div className={styles.home}>
    <h1 className={styles.header}>Requests</h1>
    <div className={styles.body}>
      <Card
        title="Request Log"
        icon={<ListDashes />}
        toolbar={
          <>
            <ChainSelect variant="outline" size="sm" placement="bottom right" />
            <StatusSelect
              variant="outline"
              size="sm"
              placement="bottom right"
            />
            <SearchBar className={styles.searchBar ?? ""} />
          </>
        }
      >
        <Results />
      </Card>
    </div>
  </div>
);
