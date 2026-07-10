# Style

Cross-cutting guidance for readable, maintainable code in any language.
Language-specific rules: [rust/](rust/AGENTS.md), [typescript/](typescript/AGENTS.md).

## Make heavy use of types to define behaviour

Introducing a type is like introducing a unit test:

```rust
struct PositiveTime(i64);
impl TryFrom<i64> for PositiveTime {
    type Err = ();
    fn try_from(n: i64) -> Result<Self, Self::Err> {
        if n < 0 { return Err(()); }
        Ok(Self(n))
    }
}
```

This narrows `i64` (native Linux time, rarely wanted negative) to our preferred
range, enforced at compile-time everywhere. We under-use types.

## Avoid monolithic event handlers, and avoid state handling in logic

Mixing logic with state-handling yields a large inline state machine whose tracking
vars are barely better than globals. Dispatch to focused sub-handlers instead:

```tsx
function handleEvent(e, state) {
    switch (e.type) {
        case Event.Websocket: handleWebsocketEvent(e, state.websockets);
        case Event.PythNet:   handlePythnetEvent(e, state.pyth_handle);
    }
}
```

## Avoid catch-all modules

Do not create `types/` or `utils/` modules. They become dumping grounds that hide
where re-use should happen and encourage unnecessary sharing.

## Favor immutability and idempotency

Both greatly reduce logic bugs.

## State should flow top-down

Create state at the entry point and flow it to other components. Avoid global state;
hide no state in separate modules.

```tsx
// main.ts
function main() {
    const db = db.init();
    initDb(db);  // pass state; never rely on a global `require('db')`
}
```

## Keep types and functions close to where they are used

Keep single-use types/functions by their definition; if re-used, lift them only as
far as a common parent — no further:

```
lib/routes.rs:validateUserId()
lib/routes/user.rs:type RequestUser
lib/routes/user/register.rs:generateRandomUsername()
```

Define types where they are used, not via a catch-all `types` module:

```tsx
// Local: used only here. Note the FeedResponse/Feed distinction for DDD.
type FeedResponse = { id: FeedId, feed: Feed };
function getFeed(id: FeedId, db: Db): FeedResponse {
    const feed: Feed = db.execute(FEED_QUERY, [id]);
    return { id, feed };
}
```

## Map functionality into submodules when a module defines a category of handlers

Split a category of handlers into submodules rather than one large file; this shows
where re-use should happen:

```
src/routes/user/register.ts
src/routes/user/login.ts
src/routes/user/add_role.ts
src/routes/index.ts
```

One big `index.ts` of `register()`, `login()`, `addRole()`, etc. yields unwieldy
files and encourages `types/` catch-alls and abused shared helpers. Keep clear API
boundaries even internally.

## Use layered architecture

Prefer a layered architecture (onion / hexagonal / DDD) separating API processing,
business logic, and data logic, defining API layers within the app:

```tsx
// web/user/register.ts — validation layer
import { registerUser, User } from 'api/user/register.ts';
function verifyUsername( ...   // one-place-use, kept local (no utils/)
function verifyPassword( ...
type RegisterRequest = { ... };
function register(req: RegisterRequest): void {
    verifyUsername(req.username);
    verifyPassword(req.password);
    registerUser({ username: req.username, password: req.password });
}
```

```tsx
// api/user/register.ts — business + data layer
import { storeUser, DbUser } from 'db/user';
function registerUser(user: User) {
    if (fetchByUsername(user.username)) throw "User Exists";
    // DbUser differs from User: a schema change won't silently break callers.
    storeUser({ username: user.username, password: hash(user.password) });
}
```

## Comments explain why, and are self-contained

Default to no comments — identifiers say *what*. Comment only when the *why* is
non-obvious (a hidden constraint, invariant, or bug workaround); make it
self-contained, meaningful with only the code:

- Don't point to tickets, PRs, or discussion. State the reason itself.
- Don't describe a diff or moment in time ("temporary"). Describe the invariant now.
- If a comment quotes a value, version, or behaviour, name it concretely to verify.
