# Style

Cross-cutting guidance for keeping the code readable and maintainable, regardless
of language. Language-specific rules live in [rust/](rust/AGENTS.md) and
[typescript/](typescript/AGENTS.md).

## Make heavy use of types to define behaviour

Introducing a type can be thought of as introducing a unit test. For example:

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

This can be thought of as reducing the valid range of `i64` to one we prefer
(given that `i64` is the native Linux time type but often we do not want negative
values) that we can enforce at compile-time. The benefit of types over unit tests
is simply that use-at-site of a type ensures behaviour everywhere, reducing the
amount of unwanted behaviour in a codebase.

We do not try hard enough to isolate behaviours through types.

## Avoid monolithic event handlers, and avoid state handling in logic

Some stateful code in our repos mixes the logic handling with the state-handling
code, which produces very long, hard-to-reason-about code that ends up as a rather
large inline state machine.

Good:

```tsx
function handleEvent(e, state) {
    switch (e.type) {
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
    var latestPythNetUpdateTime = DateTime.now();
    var clientsWaiting         = {};
    var ...

    switch (e.type) {
       // lots of inline handling
    }
}
```

## Avoid catch-all modules

Do not create `types/` or `utils/` modules. They become dumping grounds that hide
where code re-use should happen and encourage unnecessary sharing of functionality.

## Favor immutability and idempotency

Both are a huge source of reducing logic bugs.

## State should flow top-down

Whenever possible, create state at the entry point and flow it to other
components. Global state should be avoided, and no state should be hidden in
separate modules.

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
    initDb(); // Database not passed, implies global use.
}
```

## Keep types and functions close to where they are used

For types/functions that are only used once, keep them close to the definition. If
they are re-used, lift them only as far up as a common parent — no further. In the
following example, types/functions lift only as far as they are useful:

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

## Map functionality into submodules when a module defines a category of handlers

This emphasises where code re-use should happen. For example:

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

Not only does the "bad" form make large unwieldy files, it encourages things like
`types/` catch-alls, or unnecessary sharing of functionality. For example, imagine
a `usernameAsBase58` function thrown into this file that then looks useful within
an unrelated function — it becomes tempting to abuse the utility function or move
it to a vague catch-all location. Focus on clear API boundaries even within our own
codebase.

## Use layered architecture

When possible, use a layered architecture (onion / hexagonal / domain-driven
design) where we separate API processing, business logic, and data logic. The
benefit is that it defines API layers within the application itself:

```tsx
// web/user/register.ts
import { registerUser, User } from 'api/user/register.ts';

// Note locality: one-place-use functions stay near, no utils/
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
    const existing = fetchByUsername(user.username);
    if (existing) {
        throw "User Exists";
    }

    // Note again that the type used here differs from User (DbUser) which
    // prevents code breakage (such as if the schema is updated but the
    // code is not).
    storeUser({
        username: user.username,
        password: hash(user.password),
    });
}
```

## Comments explain why, and are self-contained

Default to writing no comments — well-named identifiers already say *what* the code
does. Add a comment only when the *why* is non-obvious: a hidden constraint, a
subtle invariant, or a workaround for a specific bug.

When you do write one, make it self-contained. A comment should make sense to a
reader who has only the code in front of them:

- Don't reference tickets, PRs, or ephemeral discussion as the explanation ("see
  the PR", "as discussed"). State the reason itself.
- Don't describe a diff or a moment in time ("changed this to fix X", "temporary").
  Describe the invariant that holds now.
- If a comment quotes a value, a version, or an external behaviour, name it
  concretely so the reader can verify it without hunting for context.
