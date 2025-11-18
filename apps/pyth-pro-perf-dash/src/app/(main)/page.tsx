import classes from "./page.module.scss";
import { SelectSourceStats, SourcePicker } from "../../components";

export default function Home() {
  return (
    <div>
      <main className={classes.main}>
        <div className={classes.top}>
          <SourcePicker />
        </div>
        <article>
          <div className={classes.cards}>
            <SelectSourceStats />
          </div>
        </article>
      </main>
    </div>
  );
}
