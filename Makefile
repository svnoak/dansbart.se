# Dansbart development harness.
#
# Every check target below runs the same command as the matching job in
# .github/workflows/ci.yml. A green `make check` should mean a green CI, so if
# they ever disagree, that is a bug in one of the two and worth fixing rather
# than working around.

SHELL := /bin/bash
.DEFAULT_GOAL := help

FEATURE  := backend/workers/feature
AUDIO    := backend/workers/audio
API      := backend/api
FRONTEND := frontend

# Defaults point at the docker compose stack (`make up`). CI overrides these
# with its own service containers.
DATABASE_URL ?= postgresql://postgres:password@localhost:5432/dansbart
REDIS_URL    ?= redis://localhost:6379/0

PYTEST_ENV := DATABASE_URL="$(DATABASE_URL)" REDIS_URL="$(REDIS_URL)" TESTING=true

.PHONY: help install check lint test fix \
        lint-frontend lint-feature lint-audio \
        test-frontend test-api test-feature test-audio \
        migrations up down ps logs e2e

help: ## Show available targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# The audio worker installs numpy + Cython first because madmom has no wheel
# and needs both present before its setup.py runs. Same ordering as its
# Dockerfile and the CI job.
install: ## Install all dev dependencies
	cd $(FRONTEND) && npm ci
	pip install black flake8 isort
	cd $(FEATURE) && pip install -r requirements.txt && pip install pytest pytest-cov pytest-asyncio
	cd $(AUDIO) && pip install numpy Cython && pip install -r requirements.txt && pip install pytest pytest-cov pytest-env

check: lint test ## Run everything CI runs (except docker builds)

lint: lint-frontend lint-feature lint-audio ## Run all linters

test: test-frontend test-api test-feature test-audio ## Run all test suites

fix: ## Auto-fix formatting and lint where possible
	cd $(FEATURE) && isort app tests && black app tests
	cd $(AUDIO) && isort app tests && black app tests
	cd $(FRONTEND) && npx eslint . --fix

lint-frontend: ## Lint and type-check the frontend
	cd $(FRONTEND) && npm run lint
	cd $(FRONTEND) && npm run type-check

lint-feature: ## Lint the feature worker
	cd $(FEATURE) && black --check app tests
	cd $(FEATURE) && isort --check-only app tests
	cd $(FEATURE) && flake8 app tests

lint-audio: ## Lint the audio worker
	cd $(AUDIO) && black --check app tests
	cd $(AUDIO) && isort --check-only app tests
	cd $(AUDIO) && flake8 app tests

test-frontend: ## Run frontend tests
	cd $(FRONTEND) && npm run test:run

test-api: ## Run Java API tests
	cd $(API) && mvn test -B -DskipDbBuild=true

test-feature: ## Run feature worker tests (needs db + redis)
	cd $(FEATURE) && $(PYTEST_ENV) pytest tests/ --tb=short --ignore=tests/e2e/test_youtube_fetch.py

test-audio: ## Run audio worker tests (needs db + redis)
	cd $(AUDIO) && $(PYTEST_ENV) pytest tests/ --tb=short -m "not integration"

migrations: ## Apply all migrations to the dev database and regenerate jOOQ
	cd $(API) && mvn -B generate-sources \
		-Djooq.codegen.jdbc.url=jdbc:postgresql://localhost:5432/dansbart \
		-Djooq.codegen.jdbc.user=postgres \
		-Djooq.codegen.jdbc.password=password

up: ## Start the full dev stack
	docker compose up -d

down: ## Stop the dev stack
	docker compose down

ps: ## Show dev stack status
	docker compose ps

logs: ## Tail dev stack logs
	docker compose logs -f --tail=100

e2e: ## Run the Playwright end-to-end suite against the full stack
	./e2e/run-e2e.sh
