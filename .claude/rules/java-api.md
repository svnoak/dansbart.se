---
paths:
  - "**/backend/api/**"
---

# Java API rules

## Build

- Use JDK 21 from sdkman. The Homebrew JDK 25 fails.
- Add `-Dflyway.skip=true` unless you test migrations: `./mvnw test -Dflyway.skip=true`.

## Database

- Access the database only with jOOQ. Do not use JPA, Hibernate, or plain JDBC.
- Put queries in `*JooqRepository` classes in `se.dansbart.domain.<module>`.
- `src/main/java/se/dansbart/jooq/` contains generated code. Do not edit it.
- After a schema change, run `./mvnw generate-sources -Pgenerate-jooq`.
- Codegen can change files in `jooq/` when the schema did not change. Revert those changes before you commit.

## Migrations

- Add a new Flyway file in `src/main/resources/db/migration/`. Use the next free version number: `V<n>__short_description.sql`.
- Do not edit a migration that is on `main`.

## Endpoints

- Public endpoints return DTOs from `se.dansbart.dto.response`. Do not return entities.
- Put entity-to-DTO mapping in `se.dansbart.mapper`.
- Each domain module has a `*Controller`, a `*Service`, and a `*JooqRepository`.
- After you change an endpoint, regenerate the frontend client with `npm run api:update` in `frontend/`.
- CI fails on breaking OpenAPI changes.

## Worker tasks

- `se.dansbart.worker.TaskDispatcher` sends Celery tasks by name.
- The name must match `@celery_app.task(name="...")` in the worker exactly. A wrong name fails silently.
