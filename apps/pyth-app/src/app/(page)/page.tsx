import { Logo } from "@pythnetwork/component-library/Logo";
import { Button } from "@pythnetwork/component-library/v2";

import { classes } from "./page.styles";

export default function Home() {
  return (
    <div>
      <div className={classes.comingSoon}>
        <Logo />
        <p>
          We are busy building and exciting things will be landing in this space
          soon.
        </p>
        <p>Stay tuned for updates!</p>
        <div>
          <Button>Stuff is here!</Button>
        </div>
      </div>
    </div>
  );
}
