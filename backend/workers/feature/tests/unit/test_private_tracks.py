"""
Unit tests for the handling of private tracks in worker sweeps.

A private track is a person's own imported file. Sweeps over the whole table
leave it alone. Classifier training keeps it. The worker model does not map
`is_private`, so the tests add the column with raw SQL.
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker

from app.core.models import (
    AnalysisSource,
    PlaybackLink,
    Track,
    TrackAlbum,
    TrackArtist,
    TrackDanceStyle,
    TrackStructureVersion,
)
from app.services.training import ModelTrainingService


@compiles(JSONB, "sqlite")
def compile_jsonb_for_sqlite(element, compiler, **kw):
    return "JSON"


TABLES = [
    Track.__table__,
    PlaybackLink.__table__,
    TrackArtist.__table__,
    TrackAlbum.__table__,
    AnalysisSource.__table__,
    TrackDanceStyle.__table__,
    TrackStructureVersion.__table__,
]


@pytest.fixture
def sqlite_session():
    engine = create_engine("sqlite:///:memory:")
    for table in TABLES:
        table.create(engine)
    db = sessionmaker(bind=engine)()
    yield db
    db.close()


def add_track(db, title, is_private):
    track = Track(id=uuid.uuid4(), title=title, is_private=is_private)
    db.add(track)
    db.commit()
    return track


def add_analysis_source(db, track):
    db.add(AnalysisSource(track_id=track.id, source_type="hybrid_ml_v2", raw_data={}))
    db.commit()


def test_orphan_cleanup_keeps_private_track(sqlite_session):
    add_track(sqlite_session, "Public orphan", is_private=False)
    add_track(sqlite_session, "Private file", is_private=True)

    from app.workers.tasks_light import cleanup_orphans_task

    with patch("app.workers.tasks_light.SessionLocal", return_value=sqlite_session):
        cleanup_orphans_task()

    remaining_titles = {row.title for row in sqlite_session.query(Track).all()}
    assert remaining_titles == {"Private file"}


def test_reclassify_library_skips_private_track(sqlite_session):
    public_track = add_track(sqlite_session, "Public", is_private=False)
    private_track = add_track(sqlite_session, "Private file", is_private=True)
    add_analysis_source(sqlite_session, public_track)
    add_analysis_source(sqlite_session, private_track)

    with patch("app.services.classification.StyleClassifier"):
        from app.services.classification import ClassificationService

        service = ClassificationService(sqlite_session)
    service.classifier = MagicMock()
    service.classifier.classify.return_value = []

    service.reclassify_library()

    classified_titles = {call.args[0].title for call in service.classifier.classify.call_args_list}
    assert classified_titles == {"Public"}


def test_training_rows_keep_private_track(sqlite_session):
    private_track = add_track(sqlite_session, "Private file", is_private=True)
    sqlite_session.add(
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
    sqlite_session.commit()

    rows = ModelTrainingService(sqlite_session)._select_training_rows()

    assert [row.track_id for row in rows] == [private_track.id]
