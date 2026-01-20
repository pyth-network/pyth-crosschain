import { Logo } from "@pythnetwork/component-library/Logo";

import { classes } from "./page.styles";

export default function Home() {
  return (
    <div>
      <main className={classes.main}>
        <div className={classes.comingSoon}>
          <Logo />
          <p>
            We are busy building and exciting things will be landing in this
            space soon.
          </p>
          <p>Stay tuned for updates!</p>
        </div>
      </main>
    </div>
  );
}
