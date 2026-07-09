# TypeScript style

## Biome

Use [Biome](https://biomejs.dev/) for linting and formatting — it standardizes code
quality and formatting across the monorepo. For VSCode users, install
[the official Biome extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome).

Use the strongest lint settings. Do not allow `any` globally; a stray `any` erases
the type checking that makes TypeScript worth using.

## Use `catalog:` versions for dependencies

For any dependency, use the `catalog:` version rather than declaring your own
package-specific version. The catalog is defined in the workspace manifest and
keeps a single version of each dependency across the whole monorepo. If a
dependency isn't in the catalog yet, add it to the catalog first, then reference it
with `catalog:`.

## Layered architecture

The cross-cutting [style guide](../style.md) applies directly to TypeScript.
Separate API processing, business logic, and data logic; keep types and functions
close to where they're used; and avoid catch-all `types/` and `utils/` modules.

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

    // Note that the type used here (DbUser) differs from User, which prevents
    // code breakage (such as if the schema is updated but the code is not).
    storeUser({
        username: user.username,
        password: hash(user.password),
    });
}
```
