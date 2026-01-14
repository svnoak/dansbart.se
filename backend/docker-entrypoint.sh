#!/bin/bash
set -e

echo "⏳ Waiting for database to be ready..."

# Set defaults
POSTGRES_SERVER=${POSTGRES_SERVER:-db}
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_DB=${POSTGRES_DB:-dansbart}

# Wait for PostgreSQL
counter=0
max_tries=60

until PGPASSWORD="`KATEX:0`POSTGRES_SERVER" -U "`KATEX:1`POSTGRES_DB" > /dev/null 2>&1; do
  counter=$((counter + 1))
  if [ $counter -gt $max_tries ]; then
    echo "❌ PostgreSQL did not become ready in time. Exiting."
    exit 1
  fi
  echo "⏳ PostgreSQL unavailable (attempt $counter/$max_tries) - sleeping"
  sleep 1
done

echo "✅ PostgreSQL is up"

# Only run migrations if MIGRATE=1
if [[ "$MIGRATE" == "1" ]]; then
  echo "🔄 Running Alembic migrations..."
  alembic upgrade head
  echo "✅ Migrations complete"
else
  echo "⏭️ Skipping migrations (MIGRATE != 1)"
fi

echo "🚀 Starting application"

# Execute the CMD (e.g. uvicorn)
exec "$@"