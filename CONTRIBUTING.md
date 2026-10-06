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

## Cloud storage connectors

People connect Google Drive or STRATO HiDrive under Mina låtar, and the API
stores an encrypted refresh token per person and provider. The code lives in
`backend/api/src/main/java/se/dansbart/domain/providerconnection/`.

`OAuthConnectionService` runs the authorization code flow for every
`OAuthConnector`. The connector names its provider, its slug in
`/api/connections/{slug}/start`, whether it uses PKCE, and how to build the
consent URL, exchange the code and refresh the token. To add a provider:

1. Write the connector and its `MockRestServiceServer` test, like
   `HiDriveConnector` and `HiDriveConnectorTest`.
2. Add a migration that widens the `provider` check constraints on
   `provider_connections` and `user_track_sources`, and the regex in
   `ImportTrackRequest`.
3. Add the label to `SOURCE_LABELS` in `MyLibraryPage.tsx`.
4. Add the client settings to `application.yml` and `.env.example`.

### Testing the HiDrive connector without a HiDrive account

Nobody on the project has a HiDrive account yet, so the `local` profile points
the HiDrive connector at a stub that the API itself serves under
`/stub/hidrive`. The stub fakes the consent page, the token endpoint, the folder
listing and the file download, and it needs no setup: `application-local.yml`
holds a dev client id, client secret and token encryption key.

To click through the whole flow, start the API with `SPRING_PROFILES_ACTIVE=local`
and the frontend with `npm run dev`, sign in through `/sso/initiate`, and open
`http://localhost:5173/api/connections/hidrive/start`. The consent page offers
Tillåt and Neka. After Tillåt the browser lands on `/mina-latar` and the
`provider_connections` table holds a `HIDRIVE` row.

The stub is stateless. It accepts any code or token that carries its own prefix
(`stub-code-`, `stub-access-`, `stub-refresh-`), so a restart of the API keeps a
stored connection valid. A refresh token without the prefix answers
`invalid_grant`, which the nightly refresh job turns into `NEEDS_RECONNECT`.
The folder listing under `/stub/hidrive/2.1/dir` and the download under
`/stub/hidrive/2.1/file` serve short generated WAV tones with Range support, so
the coming file picker and playback can be built against them.

To test against the real HiDrive instead, register an app on
developer.hidrive.com and set `HIDRIVE_CLIENT_ID`, `HIDRIVE_CLIENT_SECRET` and
`HIDRIVE_REDIRECT_URI`. Leave `HIDRIVE_AUTHORIZATION_URL` and `HIDRIVE_TOKEN_URL`
empty to use the production endpoints.

### Not yet verified against HiDrive

The stub mirrors the HiDrive documentation as far as it could be read without an
account. Whoever first runs the connector against a real HiDrive account should
check these points and fix the connector or the stub where they differ:

1. The token response carries `refresh_token` on the code exchange. Does a
   refresh also return a new `refresh_token`, and does the old one stay valid?
2. A revoked refresh token answers HTTP 400 or 401 with `"error":"invalid_grant"`.
   The connector treats anything else as a temporary failure and retries the next
   night.
3. `GET /2.1/file?path=...` honours a `Range` header, and an expired access token
   answers 401 or 403. `fetchAudioBlob` in the frontend depends on both.
4. `api.hidrive.strato.com` sends CORS headers for a browser `fetch` with a bearer
   token. If it does not, playback needs a proxy in the API.
5. The consent page accepts the `user,ro` scope and ignores no parameter the
   connector sends.

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
