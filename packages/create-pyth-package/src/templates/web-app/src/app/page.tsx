import classes from "./page.module.scss";

export default function Home() {
  return (
    <div>
      <main className={classes.main}>
        <ol className={classes.ol}>
          <li>
            Get started by editing <code>src/app/page.tsx</code>.
          </li>
          <li>Save and see your changes instantly.</li>
        </ol>
      </main>
    </div>
  );
}
