# Code Review Guidelines

## Cross-Service Impact

Check whether this change affects other services and they should be updated. Examples include services that reuse the same table or the same type. This is important and we shouldn't miss anything.

## Architecture Quality

Check whether the code change is architecturally good with high cohesion and low coupling. Avoid unnecessary abstractions and aim for simplicity. Raise it as a warning if it's bad.

## Language Best Practices

Check whether the code is written with the best practices of that language.

## Version Bumps

Check whether all the changed packages (that are public) have their versions bumped. Raise it as information if it's not bumped, make a suggestion on the bump (like whether it's patch/minor/major and what should change). Also suggest the lock file changes when a bump happens.

## Test Coverage

Check whether the tests have enough coverage (unit, integration, etc.). Raise it as informational if it's not there, also suggest ways to add minimal tests that test the behaviour and suggest tests for different corner cases.
