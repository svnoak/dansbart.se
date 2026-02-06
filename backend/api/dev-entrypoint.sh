#!/bin/sh
# Development entrypoint: watch source and recompile so Spring Boot DevTools can restart.
set -e
cd /app

# Initial compile so the app can start
./mvnw compile -q -DskipTests || true

# In the background: recompile every few seconds so changed files are picked up
# (DevTools will restart the app when classpath changes)
( while true; do
    sleep 3
    ./mvnw compile -q -DskipTests 2>/dev/null || true
  done ) &

exec ./mvnw spring-boot:run -DskipTests
