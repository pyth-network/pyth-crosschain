import classes from "./page.module.scss";
import { SourcePicker } from "../../components";

export default function Home() {
  return (
    <div>
      <main className={classes.main}>
        <div className={classes.top}>
          <SourcePicker />
        </div>
      </main>
    </div>
  );
}
