# Database schema and jOOQ

## Migrations (Flyway)

- **Location:** `migration/` (e.g. `V1__baseline_from_alembic.sql`)
- Flyway runs automatically on application startup.
- To add a migration: create `V2__description.sql` (or next version) in this folder.

## jOOQ code generation (from PostgreSQL)

jOOQ classes are generated from your **live PostgreSQL schema** during the normal Maven build.

- **When:** Every `mvn compile`, `mvn package`, `mvn spring-boot:run`, etc. runs the `generate-sources` phase: Flyway migrate first, then jOOQ codegen. Output goes to `src/main/jooq/`.
- **Requirement:** PostgreSQL must be running and reachable (default: `localhost:5432/dansbart`, user `postgres`, password `password`).
- **Override connection** (e.g. different host in CI): pass Maven properties:
  ```bash
  ./mvnw compile -Djooq.codegen.jdbc.url=jdbc:postgresql://yourhost:5432/yourdb \
    -Djooq.codegen.jdbc.user=user -Djooq.codegen.jdbc.password=pass
  ```
