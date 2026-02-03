import { Lock, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import {
  Button,
  Divider,
  Input,
  Text,
} from "@pythnetwork/component-library/v2";

import { classes } from "./page.styles";

export default function LoginOrSignupPage() {
  return (
    <article className={classes.root}>
      <div className={classes.group}>
        <h1>Welcome back.</h1>
        <Text color="muted" size="xl">
          Log in to your account, below.
        </Text>
      </div>
      <div className={classes.orDivider}>
        <Text color="muted">OR</Text>
        <Divider />
      </div>
      <div className={classes.group}>
        <Input
          autoComplete="off"
          beforeIcon={MagnifyingGlass}
          placeholder="name@company.com"
        />
        <Input
          autoComplete="off"
          beforeIcon={Lock}
          placeholder="Password"
          type="password"
        />
        <Button variant="outline">Sign in</Button>
      </div>
    </article>
  );
}
