# Services

Cross-language guidance for authoring services (Hermes, Fortuna, Argus, and the
rest of the monorepo's long-running processes).

## Make your services as resilient to errors as possible

- Perform more benchmarking / add benchmarking tests throughout our codebase.
  Currently there are portions of the codebase whose performance is unknown and
  may become more important as we scale. Most languages have benchmark-test
  capability; Rust has it built in, for example.
- Implement error recovery even for unlikely cases. Think about how the service can
  continue to work after different failures.
- The service should continue to work (if possible) if its dependencies are
  unavailable or broken.
- Avoid the possibility of leaving the service in a state where it is no longer able
  to start or work properly. The service should be able to recover from things like
  invalid files or unexpected database state. If that is not possible, provide clear
  error messages that explain what should be done to fix it.
- Minimize the number of dependencies required for a service to start.
- It should be possible to run multiple instances of each service at the same time.

## Set up essential tooling

- Use the strongest lint settings. It is better to have at minimum pedantic
  warnings on all projects. Examples of bad settings: allowing `any` globally in
  TypeScript, ignoring integer clippy type warnings in Rust, etc.
- Add extensive logging, metrics, and tracing capability early. Much of our code is
  missing metrics, good log handling, or the ability to do introspection on code
  that has failed in retrospect.
