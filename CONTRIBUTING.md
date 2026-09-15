# Contributing to Dansbart

## Before you start

**All contributions must be linked to an issue.** Open or find an issue before starting work. PRs without a linked issue will not be accepted — the CI check enforces this.

If you have an idea or found a bug, open an issue first and describe it. This keeps work coordinated and avoids duplicate effort.

## Workflow

1. Open or find an issue
2. Comment on the issue to signal you are working on it
3. Create a branch: `git checkout -b feat/short-description` (or `fix/`, `refactor/`, etc.)
4. Make your changes
5. Run `make check` locally — it runs the same commands CI does
6. Open a PR that references the issue (e.g. `Closes #123`)

### How code reaches users

Development is trunk-based. There is no long-lived `develop` branch.

```
feature branch --PR--> main --CI green--> :beta images --Ansible--> beta
                        |
                     tag v1.2.3 --> :latest + :v1.2.3 images --> production
```

Every commit that lands on `main` and passes CI is published as a `:beta`
image. Production is cut separately by tagging a commit that is already on
`main`; the release workflow refuses tags that point anywhere else, so nothing
reaches production without having soaked on beta first.

### Database migrations are append-only

Flyway records a checksum for every migration it applies. Editing a migration
that has already run on beta or production makes the application fail to start.
CI rejects any PR that modifies, deletes or renames an existing migration — add
a new one instead.

## Commit format

```
<type>: <short summary>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`

Examples:
```
feat: add pagination to track search endpoint
fix: correct bar rederivation for polska tracks
```

No emojis in commit messages.

## Code conventions

- **Backend (Java):** jOOQ only for database access, no JPA/Hibernate. Follow the `*JooqRepository` / `*Service` / `*Controller` pattern.
- **Frontend (React/TypeScript):** Strict TypeScript, path alias `@` for `src/`. All user-facing strings in Swedish with proper characters (å, ä, ö).
- **Python workers:** Follow existing Celery task patterns. Task names must match exactly between Java dispatch and Python decorators.

See [README.md](README.md) for architecture and development setup.

## Running checks

`make check` runs everything CI runs apart from the Docker builds. Each target
invokes the same command as its CI job, so if the two disagree that is a bug
worth fixing rather than working around.

```bash
make install   # one-time: install all dev dependencies
make check     # lint + test everything
make fix       # auto-apply formatting (black, isort, eslint --fix)
make help      # list all targets
```

Individual suites:

```bash
make test-api        # Java API
make test-frontend   # Vitest
make test-feature    # feature worker (needs db + redis: make up)
make test-audio      # audio worker (needs db + redis: make up)
make e2e             # Playwright against the full stack
```

Formatting is enforced, not advisory. `make fix` before pushing saves a round
trip.

## Repository settings (maintainers)

These are configured once in GitHub and are what make the pipeline binding
rather than advisory:

- **Branch protection on `main`** — require the **`CI Gate`** status check.
  Require it rather than the individual jobs: the Docker build jobs are
  conditional on changed paths, so requiring them directly would block merges
  whenever they are correctly skipped. `CI Gate` fails if any job failed or was
  cancelled and tolerates skipped ones.
- **Secret scanning and push protection** — free on public repositories, under
  Settings → Code security. Push protection rejects a commit containing a
  recognised credential at push time, which is strictly better than finding it
  in CI after it is already published.
- **`production` environment** — add required reviewers to turn each release
  tag into an approval gate.
- **Optional deploy notification** — set the `DEPLOY_DISPATCH_REPO` variable
  (`owner/name` of the Ansible repo) and a `DEPLOY_DISPATCH_TOKEN` secret to
  have deploys triggered automatically. Without them the workflows just publish
  images and the deployment step is skipped.

## License

By contributing, you agree that your contributions are licensed under [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html).
