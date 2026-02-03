import { Divider, Input, Text } from "@pythnetwork/component-library/v2";

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
      <Divider />
      <div className={classes.group}>
        <Input placeholder="name@company.com" />
        <Input placeholder="Password" type="password" />
      </div>
    </article>
  );
}
