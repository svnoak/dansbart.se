# Dansbart.se

Swedish folk music discovery platform powered by AI-driven dance style classification.

## Overview

Dansbart.se helps dancers and folk music enthusiasts discover traditional Swedish dance music through intelligent audio analysis and classification. The platform uses machine learning to automatically identify dance styles (Polska, Hambo, Vals, etc.) and provides curated playlists for dancers.

### Key Features

- 🎵 **Automatic Dance Style Classification** - AI-powered identification of Swedish folk dance styles
- 🔍 **Smart Discovery** - Find music by dance style, tempo, and feel
- 📊 **Audio Analysis** - Detailed rhythm, meter, and tempo analysis
- 🎯 **Curated Playlists** - Dance-ready collections for practicing and events
- 🎨 **User Feedback** - Community-driven improvement of classifications
- 📂 **Open Dataset** - Public access to analysis data and human feedback under CC BY 4.0

## Architecture

Dansbart.se is built with a clear separation between proprietary application logic and open-source analysis engine:

```
dansbart.se/
├── frontend/              # Vue.js web application
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── api/         # REST API endpoints
│   │   ├── services/    # Business logic
│   │   └── workers/     # Celery task workers
│   └── Dockerfile.*     # Container definitions
└── docker-compose.yml    # Service orchestration
```

### Technology Stack

**Frontend:**
- Vue 3 with Composition API
- TypeScript
- Tailwind CSS
- Pinia (state management)

**Backend:**
- FastAPI (Python 3.10)
- PostgreSQL with pgvector
- Redis (Celery broker)
- SQLAlchemy ORM
- Celery (distributed tasks)

**ML/Audio Analysis:**
- [NeckenML Analyzer](https://github.com/svnoak/neckenml-analyzer) (open-source)
- Essentia (audio signal processing)
- MusiCNN (audio embeddings)
- Madmom (beat tracking)
- scikit-learn (classification)

## Open Source Component: NeckenML Analyzer

The core audio analysis and classification engine is **open-source** and available at:
**https://github.com/svnoak/neckenml-analyzer**

NeckenML Analyzer is an MIT-licensed Python package that provides:
- 217-dimensional audio feature extraction
- Dance style classification with pre-trained models
- Extensible `AudioSource` interface
- Generic training pipeline

**Why open source?**
- **Transparency**: Users can understand how classifications work
- **Reusability**: Other folk music projects can benefit
- **Community**: Improvements from researchers and developers
- **Credibility**: Verifiable, non-black-box AI

Dansbart.se uses NeckenML Analyzer (installed via PyPI) as its analysis engine while keeping audio acquisition and user-facing features proprietary.

## Open Dataset

Dansbart provides public access to its analysis data and human feedback through an open dataset. This includes:

- Audio analysis features from neckenml-analyzer
- Dance style classifications with confidence scores
- Human feedback and ground truth data
- Track structure annotations

**Access the dataset:**
- 📖 Documentation: https://dansbart.se/dataset-info.html
- 🔗 API: `/api/export/dataset`
- 📝 License: CC BY 4.0
- 📂 Example scripts: See [examples/](examples/) directory

For detailed information, see [DATASET_EXPORT.md](DATASET_EXPORT.md).

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
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration
   ```

3. **Download MusiCNN models:**
   ```bash
   # Create models directory
   mkdir -p backend/app/workers/audio/models

   # Download models (required for audio analysis)
   wget https://essentia.upf.edu/models/feature-extractors/musicnn/msd-musicnn-1.pb \
     -O backend/app/workers/audio/models/msd-musicnn-1.pb

   wget https://essentia.upf.edu/models/audio-event-recognition/voice_instrumental/voice_instrumental-musicnn-msd-1.pb \
     -O backend/app/workers/audio/models/voice_instrumental-musicnn-msd-1.pb
   ```

4. **Start the application:**
   ```bash
   # Development mode (with hot-reload)
   docker-compose up

   # Or production mode
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
   ```

5. **Access the application:**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### First-Time Setup

After starting the services, the database will be automatically initialized with migrations. You can then:

1. Create an admin user (if applicable)
2. Start adding tracks for analysis
3. Explore the discovery features

## Development

### Project Structure

```
dansbart.se/
├── frontend/
│   ├── src/
│   │   ├── components/      # Vue components
│   │   ├── views/          # Page components
│   │   ├── stores/         # Pinia stores
│   │   └── services/       # API clients
│   └── Dockerfile
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routes
│   │   │   └── v1/        # API v1 endpoints
│   │   ├── core/          # Config, database, security
│   │   ├── models/        # SQLAlchemy models (extends neckenml)
│   │   ├── services/      # Business logic
│   │   │   ├── analysis.py        # Uses neckenml analyzer
│   │   │   ├── training.py        # Uses neckenml trainer with feedback
│   │   │   └── classification.py  # Classification orchestration
│   │   └── workers/
│   │       ├── audio/             # Audio acquisition (proprietary)
│   │       │   ├── fetcher.py           # Audio source implementation
│   │       │   └── youtube_source.py    # neckenml AudioSource adapter
│   │       └── tasks_*.py         # Celery tasks
│   ├── requirements.*.txt
│   ├── Dockerfile.api     # Backend API container
│   └── Dockerfile.audio   # Audio worker container
└── docker-compose.yml
```

### Running Services Individually

```bash
# Frontend only
docker-compose up frontend

# Backend API only
docker-compose up backend db redis

# Audio worker only
docker-compose up worker-audio db redis

# All workers
docker-compose up worker-audio worker-light
```

### Database Migrations

```bash
# Create a new migration
docker-compose exec backend alembic revision --autogenerate -m "Description"

# Apply migrations
docker-compose exec backend alembic upgrade head

# Rollback one migration
docker-compose exec backend alembic downgrade -1
```

### Running Tests

```bash
# Backend tests
docker-compose exec backend pytest

# Frontend tests
docker-compose exec frontend npm run test
```

## Deployment

See [README.docker.md](README.docker.md) for deployment strategies including:
- Docker Hub deployment
- GitHub Container Registry
- Production optimizations
- Image size management

## Architecture Decisions

### Why Separate NeckenML Analyzer?

**Benefits of open-sourcing the analysis engine:**

1. **Transparency** - Users can verify how dance styles are classified
2. **Trust** - Non-black-box AI builds confidence in classifications
3. **Community** - Researchers can improve folk music analysis
4. **Reusability** - Other projects can benefit (festivals, archives, research)
5. **Marketing** - "Powered by open-source AI" credibility

**What remains proprietary:**

- Audio acquisition methods (service integration)
- User interface and UX
- Playlist curation logic
- User feedback system
- Business logic and workflows

### Service Architecture

**Backend API (Lightweight):**
- FastAPI REST endpoints
- User authentication
- Database queries
- Task orchestration
- Uses neckenml for type definitions only

**Audio Worker (Heavy ML):**
- Audio analysis with neckenml
- Celery task processing
- Model inference
- Expensive computations
- Isolated from web traffic

**Light Worker:**
- Discovery tasks
- Ingestion
- Non-ML background jobs

This separation allows horizontal scaling: multiple audio workers for ML tasks, lightweight API instances for web traffic.

## License

**Dansbart.se Application**: Proprietary (not open source)

**NeckenML Analyzer**: MIT License - see the [NeckenML repository](https://github.com/svnoak/neckenml-analyzer/blob/main/LICENSE)

The open-source analysis engine can be used independently under MIT license. The dansbart.se application uses the PyPI package and integrates this engine with proprietary features.

## Contributing

### To Dansbart.se
This is a proprietary application. Contributions are not currently accepted.

### To NeckenML Analyzer
The ML analysis engine is open source! See the [NeckenML Contributing Guide](https://github.com/svnoak/neckenml-analyzer/blob/main/CONTRIBUTING.md) for:
- Reporting bugs and suggesting features
- Development setup
- Coding standards
- Pull request process

We welcome improvements to audio analysis, new dance style detection, performance optimizations, and documentation.

## Community

- **Website**: https://dansbart.se
- **NeckenML Analyzer**: https://github.com/svnoak/neckenml-analyzer
- **Issues**: Report bugs via GitHub issues in respective repos

## Acknowledgments

- Built with [NeckenML Analyzer](https://github.com/svnoak/neckenml-analyzer) (open-source)
- Audio analysis powered by [Essentia](https://essentia.upf.edu/)
- Inspired by the Swedish folk music and dance community
- Thanks to all contributors and testers

---

**Powered by open-source AI** | Swedish folk music classification made transparent and accessible
