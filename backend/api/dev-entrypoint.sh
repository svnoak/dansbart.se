#!/bin/sh
# Development entrypoint: watch source and recompile so Spring Boot DevTools can restart.
set -e
cd /app

# Flyway/jOOQ codegen (bound to generate-sources, runs on every compile) target this JDBC
# URL — its pom.xml default is localhost:5432 for host-machine mvnw runs, which doesn't
# resolve inside this container; Postgres is reachable at the `db` compose service instead.
JOOQ_JDBC_URL_OVERRIDE="-Djooq.codegen.jdbc.url=jdbc:postgresql://db:5432/dansbart"

# JAVA_TOOL_OPTIONS carries the JDWP debug-agent flag (binds port 5005) for every mvnw
# invocation in this container. Only the long-running spring-boot:run process below should
# hold that port — clearing it for the compile calls avoids a bind race between a
# still-running background compile and spring-boot:run starting up.

# Initial compile so the app can start
JAVA_TOOL_OPTIONS= ./mvnw compile -q -DskipTests $JOOQ_JDBC_URL_OVERRIDE || true

# In the background: recompile every few seconds so changed files are picked up
# (DevTools will restart the app when classpath changes)
( while true; do
    sleep 3
    JAVA_TOOL_OPTIONS= ./mvnw compile -q -DskipTests $JOOQ_JDBC_URL_OVERRIDE 2>/dev/null || true
  done ) &

exec ./mvnw spring-boot:run -DskipTests $JOOQ_JDBC_URL_OVERRIDE
