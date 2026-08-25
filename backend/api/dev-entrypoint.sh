#!/bin/sh
# Development entrypoint: watch source and recompile so Spring Boot DevTools can restart.
set -e
cd /app

# pom.xml's jOOQ codegen JDBC URL defaults to localhost, unreachable in-container.
JOOQ_JDBC_URL_OVERRIDE="-Djooq.codegen.jdbc.url=jdbc:postgresql://db:5432/dansbart"

# Forward JDWP only to the forked app JVM, not mvn's own process (which would hog the port).
DEBUG_AGENT_OPTS="$JAVA_TOOL_OPTIONS"

# Initial compile so the app can start
JAVA_TOOL_OPTIONS= ./mvnw compile -q -DskipTests $JOOQ_JDBC_URL_OVERRIDE || true

# In the background: recompile every few seconds so changed files are picked up
# (DevTools will restart the app when classpath changes)
( while true; do
    sleep 3
    JAVA_TOOL_OPTIONS= ./mvnw compile -q -DskipTests $JOOQ_JDBC_URL_OVERRIDE 2>/dev/null || true
  done ) &

exec env JAVA_TOOL_OPTIONS= ./mvnw spring-boot:run -DskipTests $JOOQ_JDBC_URL_OVERRIDE \
    "-Dspring-boot.run.jvmArguments=$DEBUG_AGENT_OPTS"
