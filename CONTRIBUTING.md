# Contributing to Dansbart

## Before you start

**All contributions must be linked to an issue.** Open or find an issue before starting work. PRs without a linked issue will not be accepted — the CI check enforces this.

If you have an idea or found a bug, open an issue first and describe it. This keeps work coordinated and avoids duplicate effort.

## Workflow

1. Open or find an issue
2. Comment on the issue to signal you are working on it
3. Create a branch: `git checkout -b feat/short-description` (or `fix/`, `refactor/`, etc.)
4. Make your changes
5. Open a PR that references the issue (e.g. `Closes #123`)

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

See `CLAUDE.md` for full architectural guidance and development setup.

## Running tests

```bash
# Java API
cd dansbart.se/backend/api && ./mvnw test

# Frontend
cd dansbart.se/frontend && npm run test:run

# Python workers
cd dansbart.se/backend/workers/feature && pytest
cd dansbart.se/backend/workers/audio && pytest
```

## License

By contributing, you agree that your contributions are licensed under [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html).
