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

## Validating schema against production

To import a production dump and compare its schema with the migration-defined schema:

1. Start PostgreSQL (e.g. `docker compose up -d db` from repo root).
2. Import the dump into a **separate** database (so dev `dansbart` is untouched):
   - **Plain SQL** (recommended; avoids pg_restore segfaults on large custom dumps):
     ```bash
     ./scripts/import-production-dump-plain.sh [path/to/dansbart_plain.sql]
     ```
   - Custom-format dump (if pg_restore works in your environment):
     ```bash
     ./scripts/import-production-dump.sh [path/to/dansbart_surgical.dump]
     ```
     Or via Docker: `./scripts/import-production-dump-docker.sh [path/to/dump.dump]`
   This creates database `dansbart_prod_import` with the production data.
3. Ensure your dev DB has migrations applied (e.g. run the API once so Flyway runs on `dansbart`).
4. Compare schemas:
   ```bash
   ./scripts/compare-schema-with-production.sh
   ```
   This writes `prod_schema.sql`, `dev_schema.sql`, and `schema_diff.txt`. Use the diff to add or adjust migrations so the codebase schema matches production (or to document intentional differences).

**Note:** Custom-format dumps (`.dump`) can cause `pg_restore` to segfault in some environments. Use a plain SQL dump (`pg_dump -Fp -f dansbart_plain.sql`) and `./scripts/import-production-dump-plain.sh` instead. The plain dump includes `CREATE EXTENSION IF NOT EXISTS vector` (production may show vector as version 0 in the catalog; the extension is still created on import). After import, run the compare script to diff schemas.
