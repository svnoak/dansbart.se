#!/usr/bin/env bash
# Run E2E tests against the full stack.
# Usage: from repo root: ./dansbart.se/e2e/run-e2e.sh
# Or:     cd dansbart.se/e2e && ./run-e2e.sh  (compose must be run from repo root separately)

set -e
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILES="-f docker-compose.yml"

echo "Starting stack (db, redis, api, frontend, worker-feature, worker-audio)..."
docker compose $COMPOSE_FILES up -d db redis api frontend worker-feature worker-audio

echo "Clearing any stale Celery messages from Redis queues..."
docker compose $COMPOSE_FILES exec -T redis redis-cli DEL light feature audio celery 2>/dev/null || true

echo "Waiting for API health (up to 90s)..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8000/actuator/health | grep -q '"status":"UP"'; then
    echo "API is up."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "API did not become healthy in time."
    exit 1
  fi
  sleep 3
done

echo "Waiting for worker-feature to be ready (up to 60s)..."
for i in $(seq 1 20); do
  if docker compose $COMPOSE_FILES logs worker-feature 2>&1 | grep -q "celery@.*ready"; then
    echo "worker-feature is ready."
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "Warning: worker-feature may not be fully ready, continuing..."
  fi
  sleep 3
done

echo "Waiting for worker-audio to be ready (up to 120s)..."
for i in $(seq 1 40); do
  if docker compose $COMPOSE_FILES logs worker-audio 2>&1 | grep -q "celery@.*ready"; then
    echo "worker-audio is ready."
    break
  fi
  if [ "$i" -eq 40 ]; then
    echo "ERROR: worker-audio did not become ready. Tracks will stay PENDING."
    echo "Check: docker compose $COMPOSE_FILES logs worker-audio"
    exit 1
  fi
  sleep 3
done

# Verify worker-audio is still running (may exit if e.g. model load fails)
if ! docker compose $COMPOSE_FILES ps worker-audio 2>/dev/null | grep -q "Up"; then
  echo "ERROR: worker-audio container is not running (exited?). Tracks will not be analysed."
  docker compose $COMPOSE_FILES logs worker-audio --tail=50
  exit 1
fi

echo "Worker status:"
docker compose $COMPOSE_FILES logs worker-feature --tail=5
docker compose $COMPOSE_FILES logs worker-audio --tail=5

echo "Redis queue state (before tests):"
docker compose $COMPOSE_FILES exec -T redis redis-cli LLEN light 2>/dev/null || echo "?"
docker compose $COMPOSE_FILES exec -T redis redis-cli LLEN feature 2>/dev/null || echo "?"
docker compose $COMPOSE_FILES exec -T redis redis-cli LLEN audio 2>/dev/null || echo "?"

echo "Running E2E tests..."
cd dansbart.se/e2e
npm ci --quiet 2>/dev/null || npm install --quiet
# Load root .env so ADMIN_PASSWORD and API_URL are set for tests
set -a
[ -f ../../.env ] && source ../../.env
set +a
npm run e2e
