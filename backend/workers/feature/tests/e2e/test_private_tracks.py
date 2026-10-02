"""
E2E tests for the handling of private tracks in worker sweeps.

A private track is a person's own imported file. Sweeps over the whole table
leave it alone. Classifier training keeps it. The worker model does not map
`is_private`, so the tests add the column with raw SQL.
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.core.models import (
    AnalysisSource,
    Track,
    TrackDanceStyle,
)
from app.services.training import ModelTrainingService


def add_track(db, title, is_private):
    track = Track(id=uuid.uuid4(), title=title, is_private=is_private)
    db.add(track)
    db.commit()
    return track


def add_analysis_source(db, track):
    db.add(AnalysisSource(track_id=track.id, source_type="hybrid_ml_v2", raw_data={}))
    db.commit()


@pytest.mark.e2e
def test_orphan_cleanup_keeps_private_track(test_db):
    add_track(test_db, "Public orphan", is_private=False)
    add_track(test_db, "Private file", is_private=True)

    from app.workers.tasks_light import cleanup_orphans_task

    with patch("app.workers.tasks_light.SessionLocal", return_value=test_db):
        cleanup_orphans_task()

    remaining_titles = {row.title for row in test_db.query(Track).all()}
    assert remaining_titles == {"Private file"}


@pytest.mark.e2e
def test_reclassify_library_skips_private_track(test_db):
    public_track = add_track(test_db, "Public", is_private=False)
    private_track = add_track(test_db, "Private file", is_private=True)
    add_analysis_source(test_db, public_track)
    add_analysis_source(test_db, private_track)

    with patch("app.services.classification.StyleClassifier"):
        from app.services.classification import ClassificationService

        service = ClassificationService(test_db)
    service.classifier = MagicMock()
    service.classifier.classify.return_value = []

    service.reclassify_library()

    classified_titles = {call.args[0].title for call in service.classifier.classify.call_args_list}
    assert classified_titles == {"Public"}


@pytest.mark.e2e
def test_training_rows_keep_private_track(test_db):
    private_track = add_track(test_db, "Private file", is_private=True)
    test_db.add(
        TrackDanceStyle(
            track_id=private_track.id,
            dance_style="Schottis",
            sub_style=None,
            is_primary=True,
            confidence=1.0,
            tempo_category="Snabbt",
            bpm_multiplier=1.0,
            effective_bpm=130,
            is_user_confirmed=True,
            source="user",
        )
    )
    test_db.commit()

    rows = ModelTrainingService(test_db)._select_training_rows()

    assert [row.track_id for row in rows] == [private_track.id]
