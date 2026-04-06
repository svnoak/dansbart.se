# Dansbart.se

Swedish folk music discovery platform powered by AI-driven dance style classification.

## Overview

Dansbart.se is a platform for finding Swedish folk music to dance to. It uses machine learning to analyse and classify tracks by dance style — Polska, Hambo, Vals, and more — based on tempo, rhythm, and audio characteristics.

## Architecture

```
frontend/               # React 19 + TypeScript + Tailwind CSS v4
backend/
  api/                  # Java Spring Boot REST API
  workers/
    feature/            # Python Celery worker (ML feature extraction, light tasks)
    audio/              # Python Celery worker (audio analysis via Essentia)
```

Service communication:

```
React frontend --> Java API (REST, :8000) --> PostgreSQL (jOOQ + pgvector)
                         |
                    Redis / Celery
                         |
             feature worker + audio worker
```

### Technology Stack

**Frontend:** React 19, TypeScript, Tailwind CSS v4, Vitest

**Backend API:** Java 21, Spring Boot 3.2, jOOQ, Flyway, PostgreSQL + pgvector

**Workers:** Python, Celery, Redis
- Feature worker: ML feature extraction and light background tasks
- Audio worker: audio download and analysis via [NeckenML Analyzer](https://github.com/svnoak/neckenml-analyzer) + Essentia (requires linux/amd64)

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Git
- 4GB+ RAM recommended

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/svnoak/dansbart.se.git
   cd dansbart.se
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.beta.example .env
   # Edit .env with your configuration
   ```

3. **Download MusiCNN models** (required for audio analysis):
   ```bash
   cd backend/workers/audio && ./scripts/download_models.sh
   ```

4. **Start the full stack:**
   ```bash
   docker compose up
   ```

5. **Access the application:**
   - Frontend: http://localhost:5173 (Vite dev server)
   - API: http://localhost:8000
   - Swagger UI: http://localhost:8000/swagger-ui.html

### Running Services Individually

```bash
# Frontend dev server only
docker compose up frontend

# API + dependencies
docker compose up backend db redis

# Audio worker only
docker compose up worker-audio db redis

# All workers
docker compose up worker-audio worker-feature
```

## Development

### Java API

```bash
cd backend/api
./mvnw clean install          # build
./mvnw spring-boot:run         # run locally
./mvnw test                    # tests
./mvnw generate-sources -Pgenerate-jooq  # regenerate jOOQ after schema changes
```

Database migrations are managed by Flyway and run automatically on startup.

### React Frontend

```bash
cd frontend
npm install
npm run dev           # Vite dev server (port 5173)
npm run test:run      # Vitest
npm run build         # production build
npm run api:update    # re-export OpenAPI spec and regenerate TypeScript client
```

### Python Workers

```bash
# Feature worker
cd backend/workers/feature
pip install -r requirements.txt
celery -A app.core.celery_app worker --loglevel=info --pool=solo -Q feature,light
pytest

# Audio worker (requires linux/amd64)
cd backend/workers/audio
pip install -r requirements.txt
celery -A app.core.celery_app worker --loglevel=info --pool=solo -Q audio
pytest
```

## Deployment

See [README.docker.md](README.docker.md) for Docker-based deployment instructions.

Production images are built and pushed to GitHub Container Registry via CI on every merge to `main`:
- `ghcr.io/svnoak/dansbart-frontend:production`
- `ghcr.io/svnoak/dansbart-api:production`
- `ghcr.io/svnoak/dansbart-feature-worker:production`
- `ghcr.io/svnoak/dansbart-audio-worker:production`

## Open Dataset

Analysis data and human feedback are publicly accessible:

- API: `GET /api/export/dataset`
- License: CC BY 4.0
- Example scripts: [examples/](examples/)

## License

**AGPL-3.0** — see [LICENSE](LICENSE).

The core analysis engine, [NeckenML Analyzer](https://github.com/svnoak/neckenml-analyzer), is a separate MIT-licensed library.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines — all PRs must be linked to an issue.

---

- **Website**: https://dansbart.se
- **NeckenML Analyzer**: https://github.com/svnoak/neckenml-analyzer
