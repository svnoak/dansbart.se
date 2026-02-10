# Dansbart Feature Worker

Classification and discovery tasks for [dansbart.se](https://dansbart.se). MIT licensed.

## Overview

This worker runs Celery tasks on the `feature` and `light` queues:

- **Classification**: Re-classify tracks from stored audio analysis using neckenml-core (`StyleClassifier`, `compute_derived_features`). Does not perform audio analysis.
- **Discovery**: Spider, ingestion, and related tasks.

## ML dependencies

This worker uses **neckenml-core** only (no neckenml-analyzer). It classifies from pre-computed artifacts already stored in the database using neckenml-core's pretrained **`custom_style_head.pkl`** (bundled with the package). It does **not** need the `.pb` MusiCNN model files (`msd-musicnn-1.pb`, `voice_instrumental-musicnn-msd-1.pb`); those are only required by the audio worker for feature extraction. The models volume mounted in the root repo's docker-compose is for path consistency and is optional for the feature worker.

## Running

From the repo root, the root `docker-compose.yml` starts the feature worker. No models volume is needed; neckenml-core uses its bundled `custom_style_head.pkl`.
