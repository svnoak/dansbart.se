---
paths:
  - "**/backend/workers/**"
---

# Python worker rules

- `backend/workers/audio/` is an unsynced copy. Make audio worker changes in `svnoak/dansbart.se-audio-worker`.
- A task name in `@celery_app.task(name="...")` must match the name in the Java `TaskDispatcher` exactly.

## Feature worker commands

Run these commands in `backend/workers/feature/`:

```bash
celery -A app.core.celery_app worker --loglevel=info --pool=solo -Q feature,light
pytest tests/ -m "not integration"
black --check app/ tests/
flake8 app/ tests/
isort --check-only app/ tests/
```

CI runs the lint commands as advisory checks. `.flake8` holds the flake8 settings.
