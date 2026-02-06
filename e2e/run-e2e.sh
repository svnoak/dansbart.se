#!/usr/bin/env bash
# Run E2E tests against the full stack.
# Usage: from repo root: ./dansbart.se/e2e/run-e2e.sh
# Or:     cd dansbart.se/e2e && ./run-e2e.sh  (compose must be run from repo root separately)

set -e
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo "Starting stack (db, redis, api, frontend, worker-feature)..."
docker compose up -d db redis api frontend worker-feature

echo "Clearing any stale Celery messages from Redis queues..."
docker compose exec -T redis redis-cli DEL light feature audio celery || true

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
  # Check if celery worker has registered tasks (look for tasks_light in output)
  if docker compose logs worker-feature 2>&1 | grep -q "celery@.*ready"; then
    echo "Worker is ready."
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "Warning: Worker may not be fully ready, but continuing..."
  fi
  sleep 3
done

# Show worker status for debugging
echo "Worker status:"
docker compose logs worker-feature --tail=10

# Check Redis queue state
echo "Redis queue state:"
docker compose exec -T redis redis-cli LLEN light || true
docker compose exec -T redis redis-cli LLEN feature || true

echo "Running E2E tests..."
cd dansbart.se/e2e
npm ci --quiet 2>/dev/null || npm install --quiet
# Load root .env so ADMIN_PASSWORD and API_URL are set for tests
set -a
[ -f ../../.env ] && source ../../.env
set +a
npm run e2e
