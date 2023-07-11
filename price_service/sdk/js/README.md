# Pyth SDK JS

The Pyth JavaScript SDK provides definitions and utilities for Pyth data structures.

Please see the [pyth.network documentation](https://docs.pyth.network/documentation/) for more information on how to use Pyth prices in various blockchains.

## Releases

We use [Semantic Versioning](https://semver.org/) for our releases. In order to release a new version of this package and publish it to npm, follow these steps:

1. Run `npm version <new version number> --no-git-tag-version`. This command will update the version of the package. Then push your changes to github.
2. Once your change is merged into `main`, create a release with tag `v<new version number>` like `v1.5.2`, and a github action will automatically publish the new version of this package to npm.
