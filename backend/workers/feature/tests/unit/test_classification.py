"""
Unit tests for ClassificationService._save_predictions.

Tests cover the T1 guard: a user-confirmed style row must survive a reclassify.
"""
import uuid
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.models import TrackDanceStyle


class FakeTrack:
    def __init__(self, track_id):
        self.id = track_id
        self.title = "Test Track"


@pytest.fixture
def sqlite_session():
    engine = create_engine("sqlite:///:memory:")
    TrackDanceStyle.__table__.create(engine)
    db = sessionmaker(bind=engine)()
    yield db
    db.close()


@pytest.fixture
def classification_service(sqlite_session):
    with patch('app.services.classification.StyleClassifier'):
        from app.services.classification import ClassificationService
        return ClassificationService(sqlite_session)


class TestSavePredictionsPreservesConfirmedStyle:
    def test_preserves_user_confirmed_style(self, classification_service, sqlite_session):
        track_id = uuid.uuid4()
        sqlite_session.add(TrackDanceStyle(
            track_id=track_id, dance_style="Schottis", sub_style=None,
            is_primary=True, confidence=1.0, tempo_category="Snabbt",
            bpm_multiplier=1.0, effective_bpm=130, confirmation_count=3,
            is_user_confirmed=True,
        ))
        sqlite_session.commit()

        track = FakeTrack(track_id)
        predictions = [{
            'style': 'Polska', 'sub_style': None, 'type': 'Primary',
            'confidence': 0.7, 'dance_tempo': 'Medium', 'multiplier': 1.0, 'effective_bpm': 110,
        }]
        classification_service._save_predictions(track, predictions)

        rows = {r.dance_style: r for r in sqlite_session.query(TrackDanceStyle)
                .filter(TrackDanceStyle.track_id == track_id).all()}

        assert rows['Schottis'].is_user_confirmed is True
        assert rows['Schottis'].effective_bpm == 130
        assert rows['Polska'].is_user_confirmed is False

    def test_skips_style_already_confirmed(self, classification_service, sqlite_session):
        track_id = uuid.uuid4()
        sqlite_session.add(TrackDanceStyle(
            track_id=track_id, dance_style="Schottis", sub_style=None,
            is_primary=True, confidence=1.0, tempo_category="Snabbt",
            bpm_multiplier=1.0, effective_bpm=130, confirmation_count=3,
            is_user_confirmed=True,
        ))
        sqlite_session.commit()

        track = FakeTrack(track_id)
        predictions = [
            {'style': 'Schottis', 'sub_style': None, 'type': 'Primary',
             'confidence': 0.6, 'dance_tempo': 'Medium', 'multiplier': 1.0, 'effective_bpm': 100},
            {'style': 'Vals', 'sub_style': None, 'type': 'Secondary',
             'confidence': 0.4, 'dance_tempo': 'Lugnt', 'multiplier': 1.0, 'effective_bpm': 90},
        ]
        classification_service._save_predictions(track, predictions)

        schottis_rows = sqlite_session.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track_id,
            TrackDanceStyle.dance_style == 'Schottis').all()
        assert len(schottis_rows) == 1
        assert schottis_rows[0].is_user_confirmed is True
        assert schottis_rows[0].effective_bpm == 130

        vals = sqlite_session.query(TrackDanceStyle).filter(
            TrackDanceStyle.track_id == track_id,
            TrackDanceStyle.dance_style == 'Vals').first()
        assert vals is not None
        assert vals.is_user_confirmed is False
