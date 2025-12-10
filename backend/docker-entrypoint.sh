#!/bin/bash
set -e

echo "Waiting for database to be ready..."

# Wait for PostgreSQL to be ready
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_SERVER" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is up - running migrations"

# Run Alembic migrations
alembic upgrade head

echo "Migrations complete - starting application"

# Execute the CMD from Dockerfile (uvicorn command)
exec "$@"
