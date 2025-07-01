# Code Guidelines

# Language specific

[Rust code guidelines](rust-code-guidelines.md)

# Make your services as resilient to errors as possible

- Perform more benchmarking/add benchmarking tests through our codebase. Currently
  there are portions of the codebase that we have unknown performance for that
  may become more important as we scale. Most languages have benchmark test
  capability, rust has it built in for example.
- Implement error recovery even for unlikely cases. Think about how the service can continue to work after different failures.
- The service should continue to work (if possible) if its dependencies are unavailable or broken.
- Avoid the possibility of leaving the service in a state where it no longer able to start or work properly. The service should be able to recover from things like invalid files or unexpected database state. If that is not possible, provide clear error messages that explain what should be done to fix it.
- Minimize the number of dependencies required for a service to start.
- It should be possible to run multiple instances of each service at the same time.

# Set up essential tooling

- Use strongest lint settings. It is better to have at minimum pedantic warnings
  on all projects. Good examples of bad settings: allowing `any` globally in
  typescript, ignoring integer clippy type warnings in Rust, etc.
- Add extensive logging, metrics and tracing capability early, much of our code is missing
  metrics, good log handling, or ability to do introspection on code that has
  failed in retrospect. Good example: hermes launch.

# Keep the code readable and maintainable

- Make heavy use of types to define behaviour. In general introducing a type can be
  thought of as introducing a unit test. For example:

      ```rust
      struct PositiveTime(i64);

      impl TryFrom<i64> for PositiveTime {
          type Err = ();
          fn try_from(n: i64) -> Result<Self, Self::Err> {
              if n < 0 {
                  return Err(());
              }
              return Ok(Self(n));
          }
      }

      ```

      This can be thought of reducing the valid range of i64 to one we prefer
      (given that i64 is the native Linux time type but often we do not want these)
      that we can enforce a compile-time. The benefit in types over unit tests is
      simply use-at-site of a type ensure behaviour everywhere and reducing the
      amount of unwanted behaviour in a codebase.

      Currently we do not try hard enough to isolate behaviours through types.

- Avoid monolithic event handlers, and avoid state handling in logic. Some
  stateful code in our repos mixes the logic handling with the state handle
  code which produces very long, hard to reason about code which ends up as
  a rather large inline state machine:

      Good:

      ```tsx
      function handleEvent(e, state) {
          switch(e.type) {
              case Event.Websocket: handleWebsocketEvent(e, state.websockets);
              case Event.PythNet:   handlePythnetEvent(e, state.pyth_handle);
              case ...
          }
      }

      ```

      Bad:

      ```tsx
      function handleEvent(e) {
          // Many inlined state tracking vars. Not much better than globals.
          var latstPythNetupdateTime = DateTime.now();
          var clientsWaiting         = {};
          var ...

          switch(e.type) {
             // lots of inline handling
          }
      }

      ```

- Avoid catch-all modules, I.E: `types/`, `utils/`
- Favor Immutability and Idempotency. Both are a huge source of reducing logic bugs.
- State should whenever possible flow top-down, I.E: create at entry point and
  flow to other components. Global state should be avoided and no state should be
  hidden in separate modules.

      Good:

      ```tsx
      // main.ts
      function main() {
          const db = db.init();
          initDb(db);
      }

      ```

      Bad:

      ```tsx
      // main.ts
      const { db } = require('db');
      function() {
          initDb(); // Databaes not passed, implies global use.
      }

      ```

- For types/functions that are only used once, keep them close to the
  definition. If they are re-used, try and lift them only up to a common
  parent, in the following example types/functions only lift as far
  as they are useful:

      Example File Hierarchy:

      ```
      lib/routes.rs:validateUserId()
      lib/routes/user.rs:type RequestUser
      lib/routes/user/register.rs:generateRandomUsername()

      ```

      Good:

      ```tsx
      // Definition only applies to this function, keep locality.
      type FeedResponse = {
          id:   FeedId,
          feed: Feed,
      };

      // Note the distinction between FeedResponse/Feed for DDD.
      function getFeed(id: FeedId, db: Db): FeedResponse {
          let feed: Feed = db.execute(FEED_QUERY, [id]);
          return { id, feed: feed, }
      }

      ```

      Bad:

      ```tsx
      import { FeedResponse } from 'types';
      function getFeed(id: FeedId, db: Db): FeedResponse {
          let feed = db.execute(FEED_QUERY, [id]);
          return { id, feed: feed, }
      }

      ```

- Map functionality into submodules when a module defines a category of handlers.
  This help emphasise where code re-use should happen, for example:

      Good:

      ```
      src/routes/user/register.ts
      src/routes/user/login.ts
      src/routes/user/add_role.ts
      src/routes/index.ts

      ```

      Bad:

      ```tsx
      // src/index.ts
      function register() { ... }
      function login() { ... }
      function addRole() { ... }
      function index() { ... }

      ```

      Not only does this make large unwieldy files but it encourages things like
      `types/` catch alls, or unnecessary sharing of functionality. For example
      imagine a `usernameAsBase58` function thrown into this file, that then
      looks useful within an unrelated to users function, it can be tempting to
      abuse the utility function or move it to a vague catch-all location. Focus
      on clear, API boundaries even within our own codebase.

- When possible use layered architecture (onion/hexagonal/domain driven design) where
  we separate API processing, business logic, and data logic. The benefit of this
  is it defines API layers within the application itself:

      Good:

      ```tsx
      // web/user/register.ts
      import { registerUser, User } from 'api/user/register.ts';

      // Note locality: one place use functions stay near, no utils/
      function verifyUsername( ...
      function verifyPassword( ...

      // Locality again.
      type RegisterRequest = {
          ...
      };

      function register(req: RegisterRequest): void {
          // Validation Logic Only
          verifyUsername(req.username);
          verifyPassword(req.password);

          // Business Logic Separate
          registerUser({
              username: req.username,
              password: req.password,
          });
      }

      ```

      ```tsx
      // api/user/register.ts
      import { storeUser, DbUser } from 'db/user';

      function registerUser(user: User) {
          const user = fetchByUsername(user.username);
          if (user) {
              throw "User Exists;
          }

          // Note again that the type used here differs from User (DbUser) which
          // prevents code breakage (such as if the schema is updated but the
          // code is not.
          storeUser({
              username: user.username,
              password: hash(user.password),
          });
      }

      ```
