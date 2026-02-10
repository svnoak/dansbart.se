# OpenAPI spec

The `openapi.yaml` in this directory is **generated from the running backend**, not from hand-written annotations alone.

- **How:** During `mvn verify`, the Spring Boot app is started in `pre-integration-test`, then [springdoc-openapi-maven-plugin](https://github.com/springdoc/springdoc-openapi-maven-plugin) fetches `/v3/api-docs` from the live app and writes the spec. The app is stopped in `post-integration-test`.
- **Why:** Generating from the actual running application (runtime introspection) keeps the spec in sync with the code and avoids drift between annotations and real behaviour.
- **Regenerate locally:** From repo root, run `./backend/api/mvnw verify -DskipTests=true` (requires PostgreSQL and Redis for the app to start). The spec is written to `api-spec/openapi.yaml`.
