"""
Shared pytest fixtures for dansbart.se backend tests.
"""
import pytest
from unittest.mock import Mock, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import uuid


@pytest.fixture
def mock_db_session():
    """A mock database session for unit tests."""
    session = MagicMock()
    session.query.return_value.filter.return_value.first.return_value = None
    session.query.return_value.filter.return_value.all.return_value = []
    return session


@pytest.fixture
def sample_track():
    """Create a sample track for testing."""
    class MockArtist:
        def __init__(self):
            self.name = "Boda Spelmanslag"

    class MockArtistLink:
        def __init__(self):
            self.role = "primary"
            self.artist = MockArtist()

    class MockDanceStyle:
        def __init__(self):
            self.dance_style = "Polska"
            self.sub_style = None
            self.is_primary = True
            self.confidence = 0.85
            self.tempo_category = "Lagom"
            self.is_user_confirmed = False
            self.confirmation_count = 0

    class MockPlaybackLink:
        def __init__(self):
            self.platform = "youtube"
            self.deep_link = "dQw4w9WgXcQ"
            self.is_working = True

    class MockAnalysisSource:
        def __init__(self):
            self.source_type = "neckenml_analyzer"
            self.raw_data = {
                "rhythm_extractor": {"beats": [], "bars": [], "ternary_confidence": 0.8},
                "musicnn": {"avg_embedding": [0.0] * 200},
                "vocal": {"vocal_score": 0.2, "instrumental_score": 0.8},
                "audio_stats": {"loudness_lufs": -14.0, "rms": 0.1, "zcr": 0.1, "onset_rate": 2.0},
                "onsets": {"librosa_onset_times": []},
                "dynamics": {"envelope": [], "beat_activations": [], "intervals": []}
            }
            self.confidence_score = 0.85
            self.analyzed_at = None

    class MockTrack:
        def __init__(self):
            self.id = uuid.uuid4()
            self.title = "Slängpolska från Boda"
            self.isrc = "SEXXXX1234567"
            self.duration_ms = 180000
            self.tempo_bpm = 120.0
            self.has_vocals = False
            self.swing_ratio = 1.15
            self.articulation = 0.45
            self.bounciness = 0.55
            self.loudness = -14.0
            self.punchiness = 0.4
            self.voice_probability = 0.2
            self.polska_score = 0.35
            self.hambo_score = 0.25
            self.bpm_stability = 0.92
            self.music_genre = "traditional_folk"
            self.genre_confidence = 0.8
            self.bars = []
            self.sections = []
            self.section_labels = []
            self.embedding = [0.0] * 217
            self.analysis_version = "0.3.0"
            self.is_flagged = False
            self.flag_reason = None
            self.created_at = None

            self.dance_styles = [MockDanceStyle()]
            self.artist_links = [MockArtistLink()]
            self.album_links = []
            self.playback_links = [MockPlaybackLink()]
            self.analysis_sources = [MockAnalysisSource()]

    return MockTrack()


@pytest.fixture
def sample_analysis_features():
    """Sample analysis features for classification tests."""
    return {
        "ml_suggested_style": "Polska",
        "ml_confidence": 0.85,
        "embedding": [0.0] * 217,
        "loudness_lufs": -14.0,
        "tempo_bpm": 120.0,
        "bpm_stability": 0.92,
        "is_likely_instrumental": True,
        "voice_probability": 0.2,
        "swing_ratio": 1.15,
        "articulation": 0.45,
        "bounciness": 0.55,
        "avg_beat_ratios": [0.33, 0.34, 0.33],
        "punchiness": 0.4,
        "polska_score": 0.35,
        "hambo_score": 0.25,
        "ternary_confidence": 0.85,
        "meter": "3/4",
        "bars": [],
        "beat_times": [],
        "sections": [],
        "section_labels": [],
        "folk_authenticity_score": 0.75,
        "requires_manual_review": False,
        "folk_authenticity_breakdown": {},
        "folk_authenticity_interpretation": "Likely traditional folk"
    }


@pytest.fixture
def fastapi_test_client():
    """Create a FastAPI test client."""
    try:
        from fastapi.testclient import TestClient
        from app.main import app

        # Override database dependency if needed
        return TestClient(app)
    except ImportError:
        pytest.skip("FastAPI test client dependencies not available")
