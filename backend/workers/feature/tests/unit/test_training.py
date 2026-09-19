"""
Unit tests for ModelTrainingService training-data selection.

Tests cover the source guard: only metadata-sourced or user-confirmed
rows enter the training set.
"""

import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.models import TrackDanceStyle
from app.services.training import ModelTrainingService


@pytest.fixture
def sqlite_session():
    engine = create_engine("sqlite:///:memory:")
    TrackDanceStyle.__table__.create(engine)
    db = sessionmaker(bind=engine)()
    yield db
    db.close()


@pytest.fixture
def training_service(sqlite_session):
    return ModelTrainingService(sqlite_session)


def make_style(track_id, confidence, is_user_confirmed, source):
    return TrackDanceStyle(
        track_id=track_id,
        dance_style="Schottis",
        sub_style=None,
        is_primary=True,
        confidence=confidence,
        tempo_category="Snabbt",
        bpm_multiplier=1.0,
        effective_bpm=130,
        is_user_confirmed=is_user_confirmed,
        source=source,
    )


class TestTrainingDataExcludesMlPredictions:
    def test_ml_source_is_excluded(self, sqlite_session, training_service):
        sqlite_session.add(
            make_style(uuid.uuid4(), confidence=0.99, is_user_confirmed=False, source="ml")
        )
        sqlite_session.commit()

        rows = training_service._select_training_rows()

        assert rows == []

    def test_metadata_source_is_included(self, sqlite_session, training_service):
        style = make_style(
            uuid.uuid4(), confidence=0.99, is_user_confirmed=False, source="metadata"
        )
        sqlite_session.add(style)
        sqlite_session.commit()

        rows = training_service._select_training_rows()

        assert [row.dance_style for row in rows] == [style.dance_style]

    def test_user_confirmed_is_included_regardless_of_source(
        self, sqlite_session, training_service
    ):
        style = make_style(uuid.uuid4(), confidence=0.4, is_user_confirmed=True, source="ml")
        sqlite_session.add(style)
        sqlite_session.commit()

        rows = training_service._select_training_rows()

        assert [row.dance_style for row in rows] == [style.dance_style]

    def test_missing_source_is_excluded(self, sqlite_session, training_service):
        sqlite_session.add(
            make_style(uuid.uuid4(), confidence=0.99, is_user_confirmed=False, source=None)
        )
        sqlite_session.commit()

        rows = training_service._select_training_rows()

        assert rows == []
