# TypeScript style

## Biome

Use [Biome](https://biomejs.dev/) for linting and formatting across the monorepo;
VSCode users should install
[the official Biome extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome).
Use the strongest lint settings, and never allow `any` globally — a stray `any`
erases the type checking that makes TypeScript worth using.

## Use `catalog:` versions for dependencies

Reference dependencies via the `catalog:` version, not a package-specific one. The
catalog (in the workspace manifest) keeps one version of each dependency across the
monorepo. If a dependency isn't there, add it to the catalog first.

## Layered architecture

The cross-cutting [style guide](../style.md) applies directly to TypeScript:
separate API processing, business logic, and data logic; keep types and functions
close to where they're used; and avoid catch-all `types/` and `utils/` modules.

```tsx
// web/user/register.ts
import { registerUser, User } from 'api/user/register.ts';

// Locality: one-place-use functions stay near, no utils/
function verifyUsername( ...
function verifyPassword( ...
type RegisterRequest = { ... };

function register(req: RegisterRequest): void {
    verifyUsername(req.username);  // validation only
    verifyPassword(req.password);
    registerUser({                 // business logic separate
        username: req.username,
        password: req.password,
    });
}
```
