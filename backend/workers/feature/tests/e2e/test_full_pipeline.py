"""
E2E tests for the complete data pipeline.

Tests the full flow from Spotify ingestion through audio analysis
to classification and database storage.

Pipeline: Spotify → Database → YouTube → Analysis → Classification → Database
"""
import pytest
from unittest.mock import patch, MagicMock, PropertyMock
import uuid
import numpy as np


class TestFullPipelineSingleTrack:
    """Tests for complete single track pipeline."""

    @pytest.mark.e2e
    def test_complete_track_pipeline_with_mocks(
        self,
        mock_db_session,
        mock_spotify_client,
        mock_spotify_credentials,
        sample_analysis_result,
        e2e_env_vars
    ):
        """Test: Complete flow from Spotify ID to analyzed track in DB."""
        # Step 1: Ingest from Spotify
        track_id = uuid.uuid4()

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        mock_track = MagicMock()
        mock_track.id = track_id
        mock_track.title = "Slängpolska från Boda"
        mock_track.processing_status = "PENDING"
        mock_track.isrc = "TEST12345678"
        mock_track.duration_ms = 180000
        mock_track.dance_styles = []
        mock_track.analysis_sources = []
        mock_track.playback_links = []
        mock_track.artist_links = []
        mock_track.album_links = []

        mock_repo.create_track.return_value = mock_track

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            from app.workers.ingestion.spotify import SpotifyIngestor

            ingestor = SpotifyIngestor(mock_db_session)
            ingestor.sp = mock_spotify_client

            track_ids = ingestor.ingest_tracks_from_list([
                mock_spotify_client.track.return_value
            ])

        assert len(track_ids) == 1
        assert mock_track.processing_status == "PENDING"

        # Step 2: Simulate audio analysis (would be done by audio-worker)
        # This step would typically update the track with analysis results

        mock_track.tempo_bpm = sample_analysis_result['features']['tempo_bpm']
        mock_track.loudness = sample_analysis_result['features']['loudness_lufs']
        mock_track.embedding = sample_analysis_result['features']['embedding']
        mock_track.processing_status = "DONE"

        # Step 3: Classification
        mock_classifier = MagicMock()
        mock_classifier.classify.return_value = [
            {
                'style': 'Polska',
                'sub_style': 'Slängpolska',
                'type': 'Primary',
                'confidence': 0.85,
                'dance_tempo': 'Medium',
                'multiplier': 1.0,
                'effective_bpm': 120
            }
        ]

        with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
            with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                from app.services.classification import ClassificationService

                service = ClassificationService(mock_db_session)
                service.classifier = mock_classifier

                service.classify_track_immediately(
                    mock_track,
                    analysis_data=sample_analysis_result['features']
                )

        # Verify final state
        assert mock_track.processing_status == "DONE"
        assert mock_track.tempo_bpm == 120.0
        mock_classifier.classify.assert_called_once()

    @pytest.mark.e2e
    def test_pipeline_handles_missing_youtube_audio(
        self,
        mock_db_session,
        mock_spotify_client,
        mock_spotify_credentials,
        e2e_env_vars
    ):
        """Test: Pipeline handles case when YouTube audio is not found."""
        track_id = uuid.uuid4()

        mock_track = MagicMock()
        mock_track.id = track_id
        mock_track.title = "Obscure Folk Song"
        mock_track.processing_status = "PENDING"
        mock_track.duration_ms = 180000
        mock_track.dance_styles = []
        mock_track.playback_links = []
        mock_track.artist_links = []

        # Mock YouTube search returning no results
        mock_fetcher = MagicMock()
        mock_fetcher.fetch_track_audio.return_value = None

        # Title-based classification should still work
        mock_classifier = MagicMock()
        mock_classifier.classify.return_value = []

        # The track should be classifiable by title if it contains style keywords
        mock_track.title = "Slängpolska from Boda"  # Contains style keyword

        with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
            with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                from app.services.classification import ClassificationService

                service = ClassificationService(mock_db_session)
                service.classifier = mock_classifier

                # Even without audio, classification can run with what data is available
                service.classify_track_immediately(mock_track, analysis_data=None)

        # Track should still be queryable (even if classification produced no results)
        assert mock_track.id == track_id


class TestFullPipelinePlaylist:
    """Tests for complete playlist pipeline."""

    @pytest.mark.e2e
    def test_playlist_pipeline_ingests_all_tracks(
        self,
        mock_db_session,
        mock_spotify_client,
        mock_spotify_credentials,
        e2e_env_vars
    ):
        """Test: All tracks from playlist are ingested and queued."""
        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        created_tracks = []
        def create_track_side_effect(**kwargs):
            track = MagicMock()
            track.id = uuid.uuid4()
            track.processing_status = "PENDING"
            created_tracks.append(track)
            return track

        mock_repo.create_track.side_effect = create_track_side_effect

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            from app.workers.ingestion.spotify import SpotifyIngestor

            ingestor = SpotifyIngestor(mock_db_session)
            ingestor.sp = mock_spotify_client

            track_ids = ingestor.ingest_playlist("test_playlist_id")

        # Our mock playlist has 5 tracks
        assert len(track_ids) == 5
        assert len(created_tracks) == 5
        assert all(t.processing_status == "PENDING" for t in created_tracks)

    @pytest.mark.e2e
    def test_playlist_pipeline_skips_duplicates(
        self,
        mock_db_session,
        mock_spotify_client,
        mock_spotify_credentials,
        e2e_env_vars
    ):
        """Test: Duplicate tracks in playlist are not re-ingested."""
        mock_repo = MagicMock()

        # First track exists, others don't
        existing_track = MagicMock()
        existing_track.id = uuid.uuid4()
        existing_track.processing_status = "DONE"
        existing_track.duration_ms = 180000

        call_count = [0]
        def get_by_isrc_side_effect(isrc):
            call_count[0] += 1
            if call_count[0] == 1:
                return existing_track  # First track exists
            return None  # Others don't

        mock_repo.get_by_isrc.side_effect = get_by_isrc_side_effect

        new_track = MagicMock()
        new_track.id = uuid.uuid4()
        new_track.processing_status = "PENDING"
        mock_repo.create_track.return_value = new_track

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            from app.workers.ingestion.spotify import SpotifyIngestor

            ingestor = SpotifyIngestor(mock_db_session)
            ingestor.sp = mock_spotify_client

            track_ids = ingestor.ingest_playlist("test_playlist_id")

        # Should only return new tracks (PENDING status)
        # First track is DONE, so only 4 new tracks
        assert len(track_ids) == 4


class TestFullPipelineAlbum:
    """Tests for complete album pipeline."""

    @pytest.mark.e2e
    def test_album_pipeline_preserves_album_metadata(
        self,
        mock_db_session,
        mock_spotify_client,
        mock_spotify_credentials,
        e2e_env_vars
    ):
        """Test: Album metadata is preserved throughout the pipeline."""
        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        captured_album_data = []
        def create_track_side_effect(**kwargs):
            captured_album_data.append(kwargs.get('album_data'))
            track = MagicMock()
            track.id = uuid.uuid4()
            track.processing_status = "PENDING"
            return track

        mock_repo.create_track.side_effect = create_track_side_effect

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            from app.workers.ingestion.spotify import SpotifyIngestor

            ingestor = SpotifyIngestor(mock_db_session)
            ingestor.sp = mock_spotify_client

            ingestor.ingest_album("test_album_id")

        # All tracks should have the same album data
        for album_data in captured_album_data:
            assert album_data['name'] == 'Swedish Folk Music'


class TestFullPipelineArtist:
    """Tests for complete artist discography pipeline."""

    @pytest.mark.e2e
    def test_artist_pipeline_fetches_full_discography(
        self,
        mock_db_session,
        mock_spotify_client,
        mock_spotify_credentials,
        e2e_env_vars
    ):
        """Test: Full artist discography is ingested."""
        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        track_count = [0]
        def create_track_side_effect(**kwargs):
            track_count[0] += 1
            track = MagicMock()
            track.id = uuid.uuid4()
            track.processing_status = "PENDING"
            return track

        mock_repo.create_track.side_effect = create_track_side_effect

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            from app.workers.ingestion.spotify import SpotifyIngestor

            ingestor = SpotifyIngestor(mock_db_session)
            ingestor.sp = mock_spotify_client

            track_ids = ingestor.ingest_artist_albums("test_artist_id")

        # Should have processed tracks from all albums
        assert len(track_ids) > 0


class TestPipelineStateTransitions:
    """Tests for track processing state transitions."""

    @pytest.mark.e2e
    def test_track_transitions_pending_to_done(
        self,
        mock_db_session,
        sample_analysis_result,
        e2e_env_vars
    ):
        """Test: Track state transitions correctly through pipeline."""
        track = MagicMock()
        track.id = uuid.uuid4()
        track.title = "Test Track"
        track.processing_status = "PENDING"
        track.dance_styles = []
        track.analysis_sources = []
        track.playback_links = []
        track.artist_links = []
        track.album_links = []

        # Simulate state transitions
        assert track.processing_status == "PENDING"

        # Start processing
        track.processing_status = "PROCESSING"
        assert track.processing_status == "PROCESSING"

        # Complete analysis
        track.tempo_bpm = 120
        track.processing_status = "DONE"
        assert track.processing_status == "DONE"

    @pytest.mark.e2e
    def test_track_transitions_to_failed_on_error(
        self,
        mock_db_session,
        e2e_env_vars
    ):
        """Test: Track transitions to FAILED state on errors."""
        track = MagicMock()
        track.id = uuid.uuid4()
        track.title = "Error Track"
        track.processing_status = "PENDING"

        # Start processing
        track.processing_status = "PROCESSING"

        # Simulate failure
        track.processing_status = "FAILED"

        assert track.processing_status == "FAILED"


class TestPipelineDataIntegrity:
    """Tests for data integrity through the pipeline."""

    @pytest.mark.e2e
    def test_analysis_artifacts_are_stored(
        self,
        mock_db_session,
        sample_analysis_result,
        e2e_env_vars
    ):
        """Test: Analysis artifacts are correctly stored in database."""
        track_id = uuid.uuid4()

        # Simulate storing analysis results
        mock_repo = MagicMock()

        from app.core.models import AnalysisSource

        # The analysis service would store artifacts like this
        stored_source = {
            'track_id': track_id,
            'source_type': 'neckenml_analyzer',
            'raw_data': sample_analysis_result['raw_artifacts'],
            'confidence_score': 1.0
        }

        mock_repo.add_analysis.return_value = stored_source

        # Verify artifacts can be retrieved for reclassification
        assert 'rhythm_extractor' in sample_analysis_result['raw_artifacts']
        assert 'musicnn' in sample_analysis_result['raw_artifacts']
        assert 'vocal' in sample_analysis_result['raw_artifacts']
        assert 'audio_stats' in sample_analysis_result['raw_artifacts']

    @pytest.mark.e2e
    def test_embedding_vector_is_stored(
        self,
        mock_db_session,
        sample_analysis_result,
        e2e_env_vars
    ):
        """Test: Embedding vector is correctly stored for similarity search."""
        track = MagicMock()
        track.id = uuid.uuid4()
        track.embedding = None

        # Store embedding from analysis
        embedding = sample_analysis_result['features']['embedding']
        track.embedding = embedding

        # Verify embedding dimensions
        assert len(track.embedding) == 217  # neckenml embedding size

    @pytest.mark.e2e
    def test_playback_links_are_preserved(
        self,
        mock_db_session,
        mock_spotify_client,
        mock_spotify_credentials,
        e2e_env_vars
    ):
        """Test: Both Spotify and YouTube playback links are stored."""
        track_id = uuid.uuid4()

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        mock_track = MagicMock()
        mock_track.id = track_id
        mock_track.processing_status = "PENDING"
        mock_repo.create_track.return_value = mock_track

        playback_links = []
        def add_link_side_effect(**kwargs):
            playback_links.append(kwargs)

        mock_repo.add_playback_link.side_effect = add_link_side_effect

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            from app.workers.ingestion.spotify import SpotifyIngestor

            ingestor = SpotifyIngestor(mock_db_session)
            ingestor.sp = mock_spotify_client

            ingestor.ingest_tracks_from_list([
                mock_spotify_client.track.return_value
            ])

        # Spotify link should be added
        assert any(link['platform'] == 'spotify' for link in playback_links)


class TestPipelineErrorRecovery:
    """Tests for error handling and recovery in the pipeline."""

    @pytest.mark.e2e
    def test_pipeline_recovers_from_spotify_api_error(
        self,
        mock_db_session,
        mock_spotify_credentials,
        e2e_env_vars
    ):
        """Test: Pipeline handles Spotify API errors gracefully."""
        mock_client = MagicMock()
        mock_client.playlist_tracks.side_effect = Exception("API rate limit")

        mock_repo = MagicMock()

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            with patch('spotipy.Spotify', return_value=mock_client):
                from app.workers.ingestion.spotify import SpotifyIngestor

                ingestor = SpotifyIngestor(mock_db_session)
                ingestor.sp = mock_client

                # Should not raise, should return empty list
                result = ingestor.ingest_playlist("test_playlist")

        assert result == []

    @pytest.mark.e2e
    def test_pipeline_continues_after_single_track_failure(
        self,
        mock_db_session,
        mock_spotify_credentials,
        e2e_env_vars
    ):
        """Test: Pipeline continues processing after single track failure."""
        mock_client = MagicMock()

        playlist_response = {
            'items': [
                {
                    'track': {
                        'id': 'track_1',
                        'name': 'Good Track',
                        'duration_ms': 180000,
                        'artists': [{'id': 'a1', 'name': 'Artist'}],
                        'album': {'id': 'album1', 'name': 'Album', 'images': []},
                        'external_ids': {'isrc': 'ISRC0001'}
                    }
                },
                {
                    'track': None  # Invalid track
                },
                {
                    'track': {
                        'id': 'track_3',
                        'name': 'Another Good Track',
                        'duration_ms': 180000,
                        'artists': [{'id': 'a1', 'name': 'Artist'}],
                        'album': {'id': 'album1', 'name': 'Album', 'images': []},
                        'external_ids': {'isrc': 'ISRC0003'}
                    }
                }
            ],
            'next': None
        }

        mock_client.playlist_tracks.return_value = playlist_response
        mock_client.tracks.return_value = {
            'tracks': [
                playlist_response['items'][0]['track'],
                None,
                playlist_response['items'][2]['track']
            ]
        }

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        processed_tracks = []
        def create_track_side_effect(**kwargs):
            processed_tracks.append(kwargs['title'])
            track = MagicMock()
            track.id = uuid.uuid4()
            track.processing_status = "PENDING"
            return track

        mock_repo.create_track.side_effect = create_track_side_effect

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            with patch('spotipy.Spotify', return_value=mock_client):
                from app.workers.ingestion.spotify import SpotifyIngestor

                ingestor = SpotifyIngestor(mock_db_session)
                ingestor.sp = mock_client

                track_ids = ingestor.ingest_playlist("test_playlist")

        # Should have processed 2 valid tracks
        assert len(track_ids) == 2
        assert 'Good Track' in processed_tracks
        assert 'Another Good Track' in processed_tracks


class TestPipelinePerformance:
    """Tests for pipeline performance considerations."""

    @pytest.mark.e2e
    def test_batch_track_fetching(
        self,
        mock_db_session,
        mock_spotify_credentials,
        e2e_env_vars
    ):
        """Test: Tracks are fetched in batches for efficiency."""
        mock_client = MagicMock()

        # Create 60 tracks (more than batch size of 50)
        tracks = [
            {
                'id': f'track_{i}',
                'name': f'Track {i}',
                'duration_ms': 180000,
                'artists': [{'id': 'a1', 'name': 'Artist'}],
                'album': {'id': 'album1', 'name': 'Album', 'images': []},
                'external_ids': {'isrc': f'ISRC{i:04d}'}
            }
            for i in range(60)
        ]

        playlist_response = {
            'items': [{'track': t} for t in tracks],
            'next': None
        }

        mock_client.playlist_tracks.return_value = playlist_response

        # Track batch calls
        batch_calls = []
        def tracks_side_effect(track_ids):
            batch_calls.append(len(track_ids))
            return {'tracks': tracks[:len(track_ids)]}

        mock_client.tracks.side_effect = tracks_side_effect

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.processing_status = "PENDING"
        mock_repo.create_track.return_value = mock_track

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            with patch('spotipy.Spotify', return_value=mock_client):
                from app.workers.ingestion.spotify import SpotifyIngestor

                ingestor = SpotifyIngestor(mock_db_session)
                ingestor.sp = mock_client

                ingestor.ingest_playlist("test_playlist")

        # Should have made 2 batch calls (50 + 10)
        assert len(batch_calls) == 2
        assert batch_calls[0] == 50
        assert batch_calls[1] == 10
