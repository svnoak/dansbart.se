"""Check that every CI job runs on main and on each pull request that affects it.

Rules:
- Every job except detect-changes and ci-gate needs detect-changes. Its `if` starts
  with the pull request escape and reads a detect-changes output.
- ci-gate needs every other job.
- Every image build uses one cache scope in cache-from and cache-to, unique per build.

Usage: python3 check_ci_workflow.py .github/workflows/ci.yml
"""

import re
import sys

import yaml

PULL_REQUEST_ESCAPE = "github.event_name != 'pull_request' ||"
SCOPE_PATTERN = re.compile(r"scope=([\w-]+)")


def as_list(needs):
    if needs is None:
        return []
    return [needs] if isinstance(needs, str) else list(needs)


def find_violations(workflow):
    jobs = workflow["jobs"]
    violations = []

    for name, job in jobs.items():
        if name in ("detect-changes", "ci-gate"):
            continue
        if "detect-changes" not in as_list(job.get("needs")):
            violations.append(f"{name}: add detect-changes to needs")
        condition = str(job.get("if", "")).strip()
        if not condition.startswith(PULL_REQUEST_ESCAPE) or "needs.detect-changes.outputs." not in condition:
            violations.append(
                f"{name}: set if to \"{PULL_REQUEST_ESCAPE} needs.detect-changes.outputs.<flag> == 'true'\""
            )

    gate_needs = set(as_list(jobs.get("ci-gate", {}).get("needs")))
    missing = sorted(set(jobs) - {"ci-gate"} - gate_needs)
    if missing:
        violations.append(f"ci-gate: add {', '.join(missing)} to needs")

    scope_owners = {}
    for name, job in jobs.items():
        for step in job.get("steps", []):
            if not str(step.get("uses", "")).startswith("docker/build-push-action"):
                continue
            options = step.get("with", {})
            scope_from = SCOPE_PATTERN.search(str(options.get("cache-from", "")))
            scope_to = SCOPE_PATTERN.search(str(options.get("cache-to", "")))
            if not scope_from or not scope_to or scope_from[1] != scope_to[1]:
                violations.append(f"{name}: use the same scope=<name> in cache-from and cache-to")
                continue
            scope = scope_from[1]
            if scope in scope_owners:
                violations.append(f"{name}: cache scope {scope} is already used by {scope_owners[scope]}")
            scope_owners[scope] = name

    return violations


def main():
    with open(sys.argv[1]) as workflow_file:
        violations = find_violations(yaml.safe_load(workflow_file))
    for violation in violations:
        print(violation)
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
