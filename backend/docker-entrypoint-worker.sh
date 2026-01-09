#!/bin/bash
set -e

echo "Waiting for database to be ready..."

# Set defaults if not provided
POSTGRES_SERVER=${POSTGRES_SERVER:-db}
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_DB=${POSTGRES_DB:-dansbart}

# Wait for PostgreSQL to be ready (with timeout)
counter=0
max_tries=60

until PGPASSWORD="$POSTGRES_PASSWORD" pg_isready -h "$POSTGRES_SERVER" -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1; do
  counter=$((counter+1))
  if [ $counter -gt $max_tries ]; then
    echo "PostgreSQL did not become ready in time. Exiting."
    exit 1
  fi
  echo "PostgreSQL is unavailable (attempt $counter/$max_tries) - sleeping"
  sleep 1
done

echo "PostgreSQL is up - starting worker (migrations handled by backend service)"

# Execute the CMD from Dockerfile (celery command)
exec "$@"
