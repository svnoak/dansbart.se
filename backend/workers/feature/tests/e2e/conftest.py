"""
E2E test fixtures for the Dansbart data pipeline.

Provides fixtures for testing the complete flow:
Spotify → YouTube → Analysis → Database
"""
import pytest
import os
import uuid
import numpy as np
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Test Spotify IDs (real IDs for integration tests)
TEST_SPOTIFY_TRACK_ID = "4uLU6hMCjMI75M1A2tKUQC"
TEST_SPOTIFY_ALBUM_ID = "4LH4d3cOWNNsVw41Gqt2kv"
TEST_SPOTIFY_ARTIST_ID = "0LyfQWJT6nXafLPZqxe9Of"
TEST_SPOTIFY_PLAYLIST_ID = "37i9dQZF1DX4JAvHpjipBk"


# =============================================================================
# Database Fixtures
# =============================================================================

@pytest.fixture(scope="session")
def test_db_url():
    """Get test database URL from environment or use default."""
    return os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql://postgres:password@localhost:5432/dansbart_test"
    )


@pytest.fixture(scope="session")
def test_engine(test_db_url):
    """Create test database engine."""
    engine = create_engine(test_db_url, pool_pre_ping=True)
    return engine


@pytest.fixture(scope="session")
def test_db_setup(test_engine):
    """Set up test database schema."""
    from app.core.database import Base

    Base.metadata.create_all(test_engine)
    yield
    Base.metadata.drop_all(test_engine)


@pytest.fixture
def test_db(test_engine, test_db_setup):
    """Create a fresh database session for each test."""
    SessionLocal = sessionmaker(bind=test_engine)
    db = SessionLocal()
    yield db
    db.rollback()
    db.close()


@pytest.fixture
def mock_db_session():
    """A mock database session for unit tests."""
    session = MagicMock()
    session.query.return_value.filter.return_value.first.return_value = None
    session.query.return_value.filter.return_value.all.return_value = []
    session.query.return_value.options.return_value.filter.return_value.first.return_value = None
    return session


# =============================================================================
# Spotify Mock Fixtures
# =============================================================================

@pytest.fixture
def mock_spotify_track_response():
    """Mock response for a single Spotify track."""
    return {
        'id': TEST_SPOTIFY_TRACK_ID,
        'name': 'Slängpolska från Boda',
        'duration_ms': 180000,
        'artists': [
            {'id': 'artist_123', 'name': 'Boda Spelmanslag'}
        ],
        'album': {
            'id': 'album_456',
            'name': 'Swedish Folk Music',
            'release_date': '2020-01-01',
            'images': [{'url': 'https://example.com/cover.jpg'}]
        },
        'external_ids': {'isrc': 'TEST12345678'}
    }


@pytest.fixture
def mock_spotify_album_response():
    """Mock response for a Spotify album."""
    return {
        'id': TEST_SPOTIFY_ALBUM_ID,
        'name': 'Swedish Folk Music',
        'release_date': '2020-01-01',
        'images': [{'url': 'https://example.com/cover.jpg'}],
        'artists': [{'id': 'artist_123', 'name': 'Boda Spelmanslag'}],
        'total_tracks': 12
    }


@pytest.fixture
def mock_spotify_album_tracks_response():
    """Mock response for album tracks."""
    return {
        'items': [
            {
                'id': f'track_{i}',
                'name': f'Polska {i}',
                'duration_ms': 180000 + i * 1000,
                'artists': [{'id': 'artist_123', 'name': 'Boda Spelmanslag'}],
                'track_number': i + 1
            }
            for i in range(3)
        ],
        'next': None
    }


@pytest.fixture
def mock_spotify_playlist_response():
    """Mock response for a Spotify playlist."""
    return {
        'items': [
            {
                'track': {
                    'id': f'track_{i}',
                    'name': f'Swedish Folk Song {i}',
                    'duration_ms': 180000 + i * 1000,
                    'artists': [{'id': f'artist_{i}', 'name': f'Artist {i}'}],
                    'album': {
                        'id': f'album_{i}',
                        'name': f'Album {i}',
                        'release_date': '2020-01-01',
                        'images': [{'url': f'https://example.com/cover_{i}.jpg'}]
                    },
                    'external_ids': {'isrc': f'TESTISRC{i:04d}'}
                }
            }
            for i in range(5)
        ],
        'next': None
    }


@pytest.fixture
def mock_spotify_client(
    mock_spotify_track_response,
    mock_spotify_album_response,
    mock_spotify_album_tracks_response,
    mock_spotify_playlist_response
):
    """Mock Spotify API client."""
    with patch('spotipy.Spotify') as MockSpotify:
        client = MagicMock()
        MockSpotify.return_value = client

        # Single track
        client.track.return_value = mock_spotify_track_response

        # Batch tracks
        client.tracks.return_value = {
            'tracks': [mock_spotify_track_response]
        }

        # Album
        client.album.return_value = mock_spotify_album_response
        client.album_tracks.return_value = mock_spotify_album_tracks_response

        # Playlist
        client.playlist_tracks.return_value = mock_spotify_playlist_response

        # Artist
        client.artist.return_value = {
            'id': TEST_SPOTIFY_ARTIST_ID,
            'name': 'Boda Spelmanslag',
            'genres': ['swedish folk', 'nordic folk']
        }
        client.artist_albums.return_value = {
            'items': [mock_spotify_album_response],
            'next': None
        }

        # Pagination helper
        client.next.return_value = None

        yield client


@pytest.fixture
def mock_spotify_credentials():
    """Mock Spotify credentials manager."""
    with patch('spotipy.oauth2.SpotifyClientCredentials') as MockCreds:
        yield MockCreds


# =============================================================================
# YouTube Mock Fixtures
# =============================================================================

@pytest.fixture
def mock_youtube_search_response():
    """Mock YouTube search result."""
    return {
        'id': 'dQw4w9WgXcQ',
        'title': 'Slängpolska från Boda - Boda Spelmanslag',
        'duration': 180,
        'view_count': 10000,
        'channel': 'Swedish Folk Music Channel'
    }


@pytest.fixture
def mock_youtube_client(mock_youtube_search_response):
    """Mock YouTube downloader (yt-dlp)."""
    with patch('yt_dlp.YoutubeDL') as MockYDL:
        ydl = MagicMock()
        MockYDL.return_value.__enter__.return_value = ydl

        ydl.extract_info.return_value = mock_youtube_search_response
        ydl.download.return_value = 0  # Success

        yield ydl


@pytest.fixture
def mock_audio_fetcher():
    """Mock AudioFetcher for testing without actual downloads."""
    with patch('app.workers.audio.fetcher.AudioFetcher') as MockFetcher:
        instance = MagicMock()
        MockFetcher.return_value = instance

        instance.fetch_track_audio.return_value = {
            'file_path': '/tmp/test_audio.mp3',
            'youtube_id': 'dQw4w9WgXcQ'
        }
        instance.cleanup.return_value = None

        yield instance


# =============================================================================
# Audio Analysis Mock Fixtures
# =============================================================================

@pytest.fixture
def sample_analysis_result():
    """Sample analysis result from AudioAnalyzer."""
    return {
        "features": {
            "ml_suggested_style": "Polska",
            "ml_confidence": 0.85,
            "embedding": list(np.random.randn(217)),
            "loudness_lufs": -14.0,
            "tempo_bpm": 120.0,
            "bpm_stability": 0.92,
            "is_likely_instrumental": True,
            "voice_probability": 0.2,
            "swing_ratio": 1.15,
            "articulation": 0.45,
            "bounciness": 0.55,
            "punchiness": 0.4,
            "polska_score": 0.35,
            "hambo_score": 0.25,
            "bars": [0.0, 1.5, 3.0, 4.5, 6.0],
            "sections": [[0, 8], [8, 16], [16, 24]],
            "section_labels": ["A", "B", "A"],
        },
        "raw_artifacts": {
            "rhythm_extractor": {
                "beats": [0.5, 1.0, 1.5, 2.0],
                "bars": [0.0, 1.5, 3.0],
                "ternary_confidence": 0.8,
                "beat_intervals": [0.5, 0.5, 0.5]
            },
            "musicnn": {
                "avg_embedding": [0.0] * 200,
                "frame_embeddings": []
            },
            "vocal": {
                "vocal_score": 0.2,
                "instrumental_score": 0.8
            },
            "audio_stats": {
                "loudness_lufs": -14.0,
                "rms": 0.1,
                "zcr": 0.05,
                "onset_rate": 2.5,
                "spectral_centroid_mean": 2000.0
            },
        },
        "actual_duration_ms": 180000
    }


@pytest.fixture
def mock_audio_analyzer(sample_analysis_result):
    """Mock AudioAnalyzer for testing without actual audio files."""
    with patch('neckenml.analyzer.AudioAnalyzer') as MockAnalyzer:
        instance = MagicMock()
        MockAnalyzer.return_value = instance

        instance.analyze_file.return_value = sample_analysis_result
        instance.close.return_value = None

        yield instance


# =============================================================================
# Classification Mock Fixtures
# =============================================================================

@pytest.fixture
def mock_style_classifier():
    """Mock StyleClassifier for testing."""
    with patch('neckenml.core.StyleClassifier') as MockClassifier:
        instance = MagicMock()
        MockClassifier.return_value = instance

        instance.classify.return_value = [
            {
                'style': 'Polska',
                'sub_style': 'Slängpolska',
                'type': 'Primary',
                'confidence': 0.85,
                'dance_tempo': 'Medium',
                'multiplier': 1.0,
                'effective_bpm': 120
            },
            {
                'style': 'Hambo',
                'sub_style': None,
                'type': 'Secondary',
                'confidence': 0.65,
                'dance_tempo': 'Medium',
                'multiplier': 1.0,
                'effective_bpm': 120
            }
        ]

        yield instance


# =============================================================================
# Track Factory Fixtures
# =============================================================================

@pytest.fixture
def sample_track():
    """Create a sample track for testing."""
    class MockArtist:
        def __init__(self):
            self.id = uuid.uuid4()
            self.name = "Boda Spelmanslag"
            self.spotify_id = "artist_123"

    class MockArtistLink:
        def __init__(self):
            self.role = "primary"
            self.artist = MockArtist()

    class MockAlbum:
        def __init__(self):
            self.id = uuid.uuid4()
            self.title = "Swedish Folk Music"
            self.spotify_id = "album_456"
            self.cover_image_url = "https://example.com/cover.jpg"

    class MockAlbumLink:
        def __init__(self):
            self.album = MockAlbum()

    class MockDanceStyle:
        def __init__(self):
            self.dance_style = "Polska"
            self.sub_style = "Slängpolska"
            self.is_primary = True
            self.confidence = 0.85
            self.effective_bpm = 120
            self.tempo_category = "Medium"
            self.bpm_multiplier = 1.0
            self.is_user_confirmed = False
            self.confirmation_count = 0

    class MockPlaybackLink:
        def __init__(self, platform="youtube"):
            self.id = uuid.uuid4()
            self.platform = platform
            self.deep_link = "dQw4w9WgXcQ" if platform == "youtube" else "spotify_track_id"
            self.is_working = True

    class MockAnalysisSource:
        def __init__(self):
            self.id = uuid.uuid4()
            self.source_type = "neckenml_analyzer"
            self.raw_data = {
                "rhythm_extractor": {"beats": [], "bars": []},
                "musicnn": {"avg_embedding": [0.0] * 200},
                "vocal": {"vocal_score": 0.2, "instrumental_score": 0.8},
                "audio_stats": {"loudness_lufs": -14.0}
            }
            self.confidence_score = 1.0

    class MockTrack:
        def __init__(self):
            self.id = uuid.uuid4()
            self.title = "Slängpolska från Boda"
            self.isrc = "TEST12345678"
            self.duration_ms = 180000
            self.processing_status = "PENDING"
            self.music_genre = "swedish_folk"
            self.genre_confidence = 0.9
            self.is_flagged = False

            # Analysis fields
            self.tempo_bpm = None
            self.has_vocals = None
            self.swing_ratio = None
            self.articulation = None
            self.bounciness = None
            self.loudness = None
            self.is_instrumental = None
            self.punchiness = None
            self.voice_probability = None
            self.polska_score = None
            self.hambo_score = None
            self.bars = None
            self.sections = None
            self.section_labels = None
            self.embedding = None

            # Relationships
            self.dance_styles = [MockDanceStyle()]
            self.artist_links = [MockArtistLink()]
            self.album_links = [MockAlbumLink()]
            self.playback_links = [MockPlaybackLink("youtube"), MockPlaybackLink("spotify")]
            self.analysis_sources = [MockAnalysisSource()]

        @property
        def album(self):
            return self.album_links[0].album if self.album_links else None

        @property
        def primary_artist(self):
            for link in self.artist_links:
                if link.role == "primary":
                    return link.artist
            return self.artist_links[0].artist if self.artist_links else None

    return MockTrack()


@pytest.fixture
def track_factory():
    """Factory for creating test tracks with custom properties."""
    def create_track(
        title="Test Track",
        isrc=None,
        duration_ms=180000,
        processing_status="PENDING",
        has_youtube=True,
        has_spotify=True,
        has_analysis=False
    ):
        from app.core.models import Track, Artist, Album, TrackArtist, TrackAlbum, PlaybackLink

        track_id = uuid.uuid4()
        isrc = isrc or f"TEST{uuid.uuid4().hex[:8].upper()}"

        track = Track(
            id=track_id,
            title=title,
            isrc=isrc,
            duration_ms=duration_ms,
            processing_status=processing_status
        )

        return track

    return create_track


# =============================================================================
# Environment Fixtures
# =============================================================================

@pytest.fixture
def e2e_env_vars(monkeypatch):
    """Set up environment variables for E2E tests."""
    monkeypatch.setenv("SPOTIPY_CLIENT_ID", "test_client_id")
    monkeypatch.setenv("SPOTIPY_CLIENT_SECRET", "test_client_secret")
    monkeypatch.setenv("NECKENML_MODEL_DIR", "/tmp/neckenml_models")
    monkeypatch.setenv("AUDIO_CACHE_DIR", "/tmp/audio_cache")
    monkeypatch.setenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/dansbart_test")


# =============================================================================
# Celery Test Fixtures
# =============================================================================

@pytest.fixture
def celery_config():
    """Configure Celery for testing."""
    return {
        'broker_url': 'memory://',
        'result_backend': 'rpc://',
        'task_always_eager': True,
        'task_eager_propagates': True
    }


@pytest.fixture
def celery_app(celery_config):
    """Create a test Celery app."""
    from celery import Celery

    app = Celery('test')
    app.config_from_object(celery_config)
    return app
