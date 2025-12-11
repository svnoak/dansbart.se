# Worker Separation Migration Guide

## Overview

The backend has been split into **3 separate Docker images** to optimize build times, image sizes, and resource allocation:

1. **Backend API** (`Dockerfile.api`) - FastAPI server only, no ML models (~500MB)
2. **Audio Worker** (`Dockerfile.audio`) - Heavy ML tasks with TensorFlow/Essentia (~2GB+)
3. **Light Worker** (`Dockerfile.workers`) - Discovery/ingestion tasks, no ML models (~800MB)

## Benefits

- ✅ **Faster API deployments**: No need to rebuild ML models when changing API code
- ✅ **Smaller images**: API image reduced from ~2GB to ~500MB
- ✅ **Better resource allocation**: Audio worker gets 4GB RAM, light worker only needs 1GB
- ✅ **Independent scaling**: Scale audio workers separately from discovery workers
- ✅ **Clearer separation**: Explicit task routing prevents ML models from loading unnecessarily

## Architecture Changes

### Before
```
Single Backend Image
├── FastAPI API (8000)
└── Single Worker
    ├── Audio Analysis (Heavy ML)
    ├── Discovery (Spotify API)
    ├── Ingestion
    └── Backfill
```

### After
```
Backend API Image (Dockerfile.api)
└── FastAPI API (8000) - No ML dependencies

Audio Worker Image (Dockerfile.audio)
└── Audio Analysis Tasks
    ├── analyze_track_task
    └── Requires: TensorFlow, Essentia, Madmom, Librosa

Light Worker Image (Dockerfile.workers)
└── Light I/O Tasks
    ├── spider_crawl_related_task
    ├── spider_crawl_search_task
    └── spider_backfill_task
```

## Files Created

### Requirements Files
- `requirements.common.txt` - Shared dependencies (SQLAlchemy, Celery, etc.)
- `requirements.api.txt` - API only (FastAPI, Uvicorn)
- `requirements.audio.txt` - Audio worker (TensorFlow, Essentia, Librosa)
- `requirements.workers.txt` - Light worker (Spotipy, BeautifulSoup)

### Dockerfiles
- `Dockerfile.api` - Lightweight API image
- `Dockerfile.audio` - Heavy ML worker image
- `Dockerfile.workers` - Light worker image
- `Dockerfile` - **Keep for now** (legacy compatibility)

### Task Files
- `app/workers/tasks_audio.py` - Audio analysis tasks
- `app/workers/tasks_light.py` - Discovery/ingestion tasks
- `app/workers/tasks.py` - **Updated** to import from both for backwards compatibility

### Configuration
- `app/core/celery_app.py` - **Updated** with task routing configuration

## Task Routing

Tasks are automatically routed to the correct worker type:

| Task | Queue | Worker | Resources |
|------|-------|--------|-----------|
| `analyze_track_task` | `audio` | Audio Worker | 4GB RAM, 2GB SHM |
| `spider_crawl_related_task` | `light` | Light Worker | 1GB RAM |
| `spider_crawl_search_task` | `light` | Light Worker | 1GB RAM |
| `spider_backfill_task` | `light` | Light Worker | 1GB RAM |

## Development Setup

### Option 1: Run All Services (Recommended)
```bash
# Start everything (API + both workers)
docker-compose up -d

# Check logs
docker-compose logs -f worker-audio
docker-compose logs -f worker-light
```

### Option 2: Run Only What You Need
```bash
# API only (no workers)
docker-compose up -d backend db redis

# API + Audio worker only
docker-compose up -d backend worker-audio db redis

# API + Light worker only
docker-compose up -d backend worker-light db redis
```

### Rebuild Images
```bash
# Rebuild all
docker-compose build

# Rebuild specific service
docker-compose build worker-audio
docker-compose build worker-light
docker-compose build backend
```

## Production Deployment

### 1. Update GitHub Actions (CI/CD)

Update your `.github/workflows/` files to build and push 3 images:

```yaml
# Example: Build and push all images
- name: Build and push Backend API
  uses: docker/build-push-action@v5
  with:
    context: ./backend
    file: ./backend/Dockerfile.api
    push: true
    tags: ghcr.io/svnoak/dansbart-backend:production

- name: Build and push Audio Worker
  uses: docker/build-push-action@v5
  with:
    context: ./backend
    file: ./backend/Dockerfile.audio
    push: true
    tags: ghcr.io/svnoak/dansbart-audio-worker:production

- name: Build and push Light Worker
  uses: docker/build-push-action@v5
  with:
    context: ./backend
    file: ./backend/Dockerfile.workers
    push: true
    tags: ghcr.io/svnoak/dansbart-light-worker:production
```

### 2. Deploy with Docker Compose

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Restart services
docker-compose -f docker-compose.prod.yml up -d

# Check worker status
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f worker-audio
docker-compose -f docker-compose.prod.yml logs -f worker-light
```

### 3. Rollback Strategy

If you need to rollback, the old `Dockerfile` still exists:

```yaml
# In docker-compose.yml, temporarily revert:
worker:
  build: ./backend  # Uses old Dockerfile
  command: celery -A app.core.celery_app worker --loglevel=info --pool=solo
```

## Testing

### Verify Task Routing

```python
# In your backend container or Python shell
from app.workers.tasks import analyze_track_task, spider_backfill_task

# These should route to the correct queues
result = analyze_track_task.delay("some-track-id")  # → audio queue
result = spider_backfill_task.delay(10)  # → light queue
```

### Check Celery Queues

```bash
# Exec into backend container
docker-compose exec backend bash

# Inspect Celery
celery -A app.core.celery_app inspect active_queues
```

Expected output:
```
worker-audio@...:
  - audio

worker-light@...:
  - light
```

### Monitor Worker Activity

```bash
# Watch audio worker
docker-compose logs -f worker-audio | grep "AUDIO WORKER"

# Watch light worker
docker-compose logs -f worker-light | grep "LIGHT WORKER"
```

## Troubleshooting

### Issue: Tasks not being processed

**Check 1**: Are workers running?
```bash
docker-compose ps
```

**Check 2**: Are workers connected to Redis?
```bash
docker-compose logs worker-audio | grep "Connected to redis"
docker-compose logs worker-light | grep "Connected to redis"
```

**Check 3**: Task routing configuration
```python
# In Python shell
from app.core.celery_app import celery_app
print(celery_app.conf.task_routes)
```

### Issue: Audio worker crashes with memory error

**Solution**: Increase memory limit in docker-compose.yml
```yaml
worker-audio:
  mem_limit: '6g'  # Increase from 4g
  shm_size: '3gb'  # Increase from 2gb
```

### Issue: Import errors in workers

**Check**: Task files are properly imported in `celery_app.py`
```python
# Should include:
include=[
    "app.workers.tasks",
    "app.workers.tasks_audio",
    "app.workers.tasks_light",
]
```

### Issue: Old code still importing from tasks.py

**No problem!** `tasks.py` re-exports all tasks for backwards compatibility:
```python
from app.workers.tasks import analyze_track_task  # Still works!
```

## Performance Comparison

### Image Sizes (Approximate)

| Image | Before | After | Savings |
|-------|--------|-------|---------|
| Backend API | ~2.2GB | ~500MB | **77% smaller** |
| Audio Worker | N/A | ~2.2GB | Same as before |
| Light Worker | N/A | ~800MB | - |

### Build Times (Approximate)

| Scenario | Before | After |
|----------|--------|-------|
| API code change | 8-10 min | **2-3 min** |
| Worker code change | 8-10 min | 8-10 min (audio) or 3-4 min (light) |
| Fresh build (all) | 10-12 min | 12-15 min (parallel builds) |

### Memory Usage

| Service | Before | After |
|---------|--------|-------|
| Backend API | ~200MB | ~150MB (no ML imports) |
| Audio Worker | 2-3GB | 2-3GB (unchanged) |
| Light Worker | N/A | ~100MB |

## Next Steps

1. ✅ Test locally with `docker-compose up`
2. ✅ Verify task routing works correctly
3. ✅ Update GitHub Actions to build 3 images
4. ✅ Deploy to production with `docker-compose.prod.yml`
5. ✅ Monitor logs for any issues
6. ✅ Scale workers independently as needed

## Scaling Examples

### Scale up audio workers (busy analysis period)
```bash
docker-compose up -d --scale worker-audio=3
```

### Scale up light workers (heavy discovery/backfill)
```bash
docker-compose up -d --scale worker-light=2
```

### Mixed scaling
```bash
docker-compose up -d --scale worker-audio=2 --scale worker-light=3
```

## Future Improvements

- [ ] Separate Dockerfile for frontend builds (if applicable)
- [ ] Consider multi-stage builds to reduce layer duplication
- [ ] Add health checks for workers
- [ ] Implement worker auto-scaling based on queue depth
- [ ] Add Prometheus metrics for worker monitoring

## Questions?

If you encounter any issues or have questions about the migration:
1. Check the logs: `docker-compose logs -f <service-name>`
2. Verify task routing: See "Testing" section above
3. Review Celery configuration in `app/core/celery_app.py`
4. Check Redis connection: `docker-compose exec redis redis-cli PING`
