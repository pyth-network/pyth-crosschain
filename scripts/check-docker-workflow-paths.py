#!/usr/bin/env python3
"""Check that every `docker-*.yml` `paths:` filter covers what its image builds from.

Several images build from the repo root and `COPY` sibling Cargo workspace members
plus the root `Cargo.lock`, so a filter scoped to a single app directory silently
skips rebuilds when a sibling member or the lockfile changes. Since those builds run
`cargo build --locked`, the resulting breakage surfaces on an unrelated PR instead of
the one that caused it. Deriving the expected filter from the Dockerfile's own `COPY`
sources keeps the two from drifting apart.

Run from the repository root: `python3 scripts/check-docker-workflow-paths.py`
"""

from __future__ import annotations

import posixpath
import re
import shlex
import sys
from pathlib import Path

import yaml

WORKFLOW_DIR = Path(".github/workflows")
BUILD_PUSH_ACTION = "docker/build-push-action"


def parse_triggers(workflow: dict) -> dict:
    # PyYAML resolves the bare `on:` key to the boolean True (YAML 1.1).
    return workflow.get("on", workflow.get(True, {}))


def iter_steps(workflow: dict):
    for job in (workflow.get("jobs") or {}).values():
        yield from job.get("steps") or []


def find_builds(workflow: dict) -> list[tuple[str, str]]:
    """Return (context, dockerfile) pairs the workflow builds, repo-root relative."""
    builds = []
    for step in iter_steps(workflow):
        uses = step.get("uses") or ""
        if uses.split("@")[0] == BUILD_PUSH_ACTION:
            with_ = step.get("with") or {}
            if with_.get("file"):
                builds.append((str(with_.get("context", ".")), str(with_["file"])))
            continue
        run = step.get("run")
        if not run:
            continue
        for command in re.split(r"\bdocker build\b", run.replace("\\\n", " "))[1:]:
            command = command.split("\n")[0]
            dockerfile = re.search(r"-f\s+(\S+)", command)
            args = [a for a in command.split() if not a.startswith("-")]
            if dockerfile and args:
                builds.append((args[-1], dockerfile.group(1)))
    return builds


def copy_sources(dockerfile: Path) -> list[str]:
    """Return the `COPY` source arguments of a Dockerfile, ignoring stage copies."""
    text = dockerfile.read_text().replace("\\\n", " ")
    sources = []
    for line in text.splitlines():
        instruction, _, rest = line.strip().partition(" ")
        if instruction.upper() != "COPY":
            continue
        args = shlex.split(rest)
        if any(a.startswith("--from=") for a in args):
            continue
        args = [a for a in args if not a.startswith("--")]
        sources.extend(args[:-1])
    return sources


def required_paths(context: str, dockerfile: Path) -> list[str] | None:
    """Repo-relative paths the build consumes, or None if it consumes the whole context."""
    base = posixpath.normpath(context)
    paths = []
    for source in copy_sources(dockerfile):
        resolved = posixpath.normpath(posixpath.join(base, source))
        if resolved in (".", ".."):
            return None
        paths.append(resolved)
    return paths


def is_covered(path: str, patterns: list[str]) -> bool:
    for pattern in patterns:
        if pattern == path:
            return True
        if pattern.endswith("/**"):
            prefix = pattern[:-3]
            if path == prefix or path.startswith(prefix + "/"):
                return True
    return False


def suggest(path: str) -> str:
    return f"{path}/**" if Path(path).is_dir() else path


def check(workflow_file: Path) -> list[str]:
    workflow = yaml.safe_load(workflow_file.read_text())
    pull_request = parse_triggers(workflow).get("pull_request")
    if not isinstance(pull_request, dict) or "paths" not in pull_request:
        return []

    patterns = pull_request["paths"]
    self_path = workflow_file.as_posix()
    required = {self_path}
    for context, dockerfile in find_builds(workflow):
        paths = required_paths(context, Path(dockerfile))
        if paths is None:
            # The build context is the whole repo, so no filter can be derived from it.
            return []
        required.update(paths)

    missing = sorted(p for p in required if not is_covered(p, patterns))
    return [suggest(p) for p in missing]


def main() -> int:
    failures = {}
    for workflow_file in sorted(WORKFLOW_DIR.glob("docker-*.yml")):
        missing = check(workflow_file)
        if missing:
            failures[workflow_file] = missing

    for workflow_file, missing in failures.items():
        print(f"{workflow_file}: `paths:` is missing entries the build depends on:")
        for entry in missing:
            print(f'      - "{entry}"')

    if failures:
        print(
            "\nAdd the entries above to each workflow's `on.pull_request.paths`, or "
            "update the Dockerfile's COPY lines if the dependency is no longer real."
        )
        return 1

    print("All docker-*.yml paths filters cover their build inputs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
