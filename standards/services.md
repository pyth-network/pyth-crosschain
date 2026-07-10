# Services

Cross-language guidance for authoring services (Hermes, Fortuna, Argus, and the rest of the monorepo's long-running processes).

## Make your services as resilient to errors as possible

- Add benchmarking tests throughout the codebase. Parts of it have unknown performance that will matter more as we scale; most languages support benchmark tests (Rust has it built in).
- Implement error recovery even for unlikely cases; think about how the service continues working after different failures.
- The service should keep working (if possible) when its dependencies are unavailable or broken.
- Avoid states where the service can no longer start or work properly. It should recover from things like invalid files or unexpected database state; if not, give clear error messages explaining the fix.
- Minimize the dependencies required for a service to start.
- It should be possible to run multiple instances of each service simultaneously.

## Set up essential tooling

- Use the strongest lint settings, at minimum pedantic warnings on all projects. Bad examples: allowing `any` globally in TypeScript, ignoring integer clippy warnings in Rust.
- Add extensive logging, metrics, and tracing early. Much of our code lacks metrics, good log handling, or introspection into past failures.
