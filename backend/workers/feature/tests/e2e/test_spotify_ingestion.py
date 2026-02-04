"""
E2E tests for Spotify ingestion.

Tests the SpotifyIngestor class which imports tracks from
Spotify playlists, albums, and artist discographies.
"""
import pytest
from unittest.mock import patch, MagicMock
import uuid


class TestSpotifyTrackIngestion:
    """Tests for single track ingestion from Spotify."""

    @pytest.mark.e2e
    def test_ingest_single_track_creates_database_entry(
        self, mock_db_session, mock_spotify_client, mock_spotify_credentials, e2e_env_vars
    ):
        """Test: Single track is correctly ingested from Spotify."""
        from app.workers.ingestion.spotify import SpotifyIngestor

        # Set up mock repository
        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None  # Track doesn't exist

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.processing_status = "PENDING"
        mock_repo.create_track.return_value = mock_track

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            ingestor = SpotifyIngestor(mock_db_session)
            # Inject the mock client
            ingestor.sp = mock_spotify_client

            # Ingest a single track via playlist
            track_ids = ingestor.ingest_tracks_from_list([
                mock_spotify_client.track.return_value
            ])

        assert len(track_ids) == 1
        mock_repo.create_track.assert_called_once()

    @pytest.mark.e2e
    def test_ingest_track_with_isrc(
        self, mock_db_session, mock_spotify_client, mock_spotify_credentials, e2e_env_vars
    ):
        """Test: Track with ISRC is stored with correct identifier."""
        from app.workers.ingestion.spotify import SpotifyIngestor

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.processing_status = "PENDING"
        mock_repo.create_track.return_value = mock_track

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            ingestor = SpotifyIngestor(mock_db_session)
            ingestor.sp = mock_spotify_client

            ingestor.ingest_tracks_from_list([
                mock_spotify_client.track.return_value
            ])

        # Verify ISRC was used
        call_kwargs = mock_repo.create_track.call_args
        assert call_kwargs.kwargs['isrc'] == 'TEST12345678'

    @pytest.mark.e2e
    def test_ingest_track_without_isrc_generates_fallback(
        self, mock_db_session, mock_spotify_client, mock_spotify_credentials, e2e_env_vars
    ):
        """Test: Track without ISRC gets a fallback identifier."""
        from app.workers.ingestion.spotify import SpotifyIngestor

        # Track without ISRC
        track_response = mock_spotify_client.track.return_value.copy()
        track_response['external_ids'] = {}

        mock_spotify_client.tracks.return_value = {'tracks': [track_response]}

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.processing_status = "PENDING"
        mock_repo.create_track.return_value = mock_track

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            ingestor = SpotifyIngestor(mock_db_session)
            ingestor.sp = mock_spotify_client

            ingestor.ingest_tracks_from_list([track_response])

        # Verify fallback ISRC was generated
        call_kwargs = mock_repo.create_track.call_args
        assert call_kwargs.kwargs['isrc'].startswith('FALLBACK-')

    @pytest.mark.e2e
    def test_existing_track_not_duplicated(
        self, mock_db_session, mock_spotify_client, mock_spotify_credentials, e2e_env_vars
    ):
        """Test: Existing track is not duplicated in database."""
        from app.workers.ingestion.spotify import SpotifyIngestor

        # Track already exists
        existing_track = MagicMock()
        existing_track.id = uuid.uuid4()
        existing_track.processing_status = "DONE"  # Already processed
        existing_track.duration_ms = 180000

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = existing_track

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            ingestor = SpotifyIngestor(mock_db_session)
            ingestor.sp = mock_spotify_client

            track_ids = ingestor.ingest_tracks_from_list([
                mock_spotify_client.track.return_value
            ])

        # Should not create new track, and should skip (not in pending list)
        mock_repo.create_track.assert_not_called()
        assert len(track_ids) == 0


class TestSpotifyPlaylistIngestion:
    """Tests for playlist ingestion from Spotify."""

    @pytest.mark.e2e
    def test_ingest_playlist_fetches_all_tracks(
        self, mock_db_session, mock_spotify_client, mock_spotify_credentials, e2e_env_vars
    ):
        """Test: All tracks from playlist are fetched."""
        from app.workers.ingestion.spotify import SpotifyIngestor

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.processing_status = "PENDING"
        mock_repo.create_track.return_value = mock_track

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            ingestor = SpotifyIngestor(mock_db_session)
            ingestor.sp = mock_spotify_client

            track_ids = ingestor.ingest_playlist("test_playlist_id")

        # Should fetch playlist tracks
        mock_spotify_client.playlist_tracks.assert_called_once_with("test_playlist_id")
        # Our mock playlist has 5 tracks
        assert len(track_ids) == 5

    @pytest.mark.e2e
    def test_ingest_playlist_handles_pagination(
        self, mock_db_session, mock_spotify_credentials, e2e_env_vars
    ):
        """Test: Playlist pagination is handled correctly."""
        from app.workers.ingestion.spotify import SpotifyIngestor

        # Mock paginated response
        mock_client = MagicMock()

        page1 = {
            'items': [
                {
                    'track': {
                        'id': f'track_{i}',
                        'name': f'Track {i}',
                        'duration_ms': 180000,
                        'artists': [{'id': 'a1', 'name': 'Artist'}],
                        'album': {'id': 'album1', 'name': 'Album', 'images': []},
                        'external_ids': {'isrc': f'ISRC{i:04d}'}
                    }
                }
                for i in range(3)
            ],
            'next': 'page2_url'
        }

        page2 = {
            'items': [
                {
                    'track': {
                        'id': f'track_{i}',
                        'name': f'Track {i}',
                        'duration_ms': 180000,
                        'artists': [{'id': 'a1', 'name': 'Artist'}],
                        'album': {'id': 'album1', 'name': 'Album', 'images': []},
                        'external_ids': {'isrc': f'ISRC{i:04d}'}
                    }
                }
                for i in range(3, 5)
            ],
            'next': None
        }

        mock_client.playlist_tracks.return_value = page1
        mock_client.next.return_value = page2
        mock_client.tracks.return_value = {'tracks': []}

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.processing_status = "PENDING"
        mock_repo.create_track.return_value = mock_track

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            with patch('spotipy.Spotify', return_value=mock_client):
                with patch('spotipy.oauth2.SpotifyClientCredentials'):
                    ingestor = SpotifyIngestor(mock_db_session)
                    ingestor.sp = mock_client

                    track_ids = ingestor.ingest_playlist("test_playlist")

        # Should have paginated through both pages
        mock_client.next.assert_called_once()
        assert len(track_ids) == 5

    @pytest.mark.e2e
    def test_ingest_playlist_skips_local_tracks(
        self, mock_db_session, mock_spotify_credentials, e2e_env_vars
    ):
        """Test: Local (non-Spotify) tracks are skipped."""
        from app.workers.ingestion.spotify import SpotifyIngestor

        mock_client = MagicMock()

        # Include a local track
        playlist_response = {
            'items': [
                {
                    'track': {
                        'id': 'track_1',
                        'name': 'Regular Track',
                        'duration_ms': 180000,
                        'artists': [{'id': 'a1', 'name': 'Artist'}],
                        'album': {'id': 'album1', 'name': 'Album', 'images': []},
                        'external_ids': {'isrc': 'ISRC0001'},
                        'is_local': False
                    }
                },
                {
                    'track': {
                        'id': None,  # Local tracks have no ID
                        'name': 'Local Track',
                        'duration_ms': 180000,
                        'artists': [{'id': 'a1', 'name': 'Artist'}],
                        'is_local': True
                    }
                }
            ],
            'next': None
        }

        mock_client.playlist_tracks.return_value = playlist_response
        mock_client.tracks.return_value = {'tracks': [playlist_response['items'][0]['track']]}

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.processing_status = "PENDING"
        mock_repo.create_track.return_value = mock_track

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            with patch('spotipy.Spotify', return_value=mock_client):
                with patch('spotipy.oauth2.SpotifyClientCredentials'):
                    ingestor = SpotifyIngestor(mock_db_session)
                    ingestor.sp = mock_client

                    track_ids = ingestor.ingest_playlist("test_playlist")

        # Only regular track should be ingested
        assert len(track_ids) == 1


class TestSpotifyAlbumIngestion:
    """Tests for album ingestion from Spotify."""

    @pytest.mark.e2e
    def test_ingest_album_fetches_all_tracks(
        self, mock_db_session, mock_spotify_client, mock_spotify_credentials, e2e_env_vars
    ):
        """Test: All tracks from album are ingested."""
        from app.workers.ingestion.spotify import SpotifyIngestor

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.processing_status = "PENDING"
        mock_repo.create_track.return_value = mock_track

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            ingestor = SpotifyIngestor(mock_db_session)
            ingestor.sp = mock_spotify_client

            track_ids = ingestor.ingest_album("test_album_id")

        mock_spotify_client.album.assert_called_once_with("test_album_id")
        mock_spotify_client.album_tracks.assert_called_once_with("test_album_id")
        # Our mock album has 3 tracks
        assert len(track_ids) == 3

    @pytest.mark.e2e
    def test_ingest_album_preserves_album_data(
        self, mock_db_session, mock_spotify_client, mock_spotify_credentials, e2e_env_vars
    ):
        """Test: Album metadata is preserved for all tracks."""
        from app.workers.ingestion.spotify import SpotifyIngestor

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.processing_status = "PENDING"
        mock_repo.create_track.return_value = mock_track

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            ingestor = SpotifyIngestor(mock_db_session)
            ingestor.sp = mock_spotify_client

            ingestor.ingest_album("test_album_id")

        # Check that album_data was passed to create_track
        call_kwargs = mock_repo.create_track.call_args
        assert call_kwargs.kwargs['album_data']['name'] == 'Swedish Folk Music'


class TestSpotifyArtistIngestion:
    """Tests for artist discography ingestion from Spotify."""

    @pytest.mark.e2e
    def test_ingest_artist_albums_fetches_discography(
        self, mock_db_session, mock_spotify_client, mock_spotify_credentials, e2e_env_vars
    ):
        """Test: All albums from artist discography are fetched."""
        from app.workers.ingestion.spotify import SpotifyIngestor

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.processing_status = "PENDING"
        mock_repo.create_track.return_value = mock_track

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            ingestor = SpotifyIngestor(mock_db_session)
            ingestor.sp = mock_spotify_client

            track_ids = ingestor.ingest_artist_albums("test_artist_id")

        mock_spotify_client.artist_albums.assert_called_once()
        # Should have fetched tracks from the mock album
        assert len(track_ids) > 0

    @pytest.mark.e2e
    def test_ingest_artist_handles_api_errors(
        self, mock_db_session, mock_spotify_credentials, e2e_env_vars
    ):
        """Test: API errors during artist ingestion are handled gracefully."""
        from app.workers.ingestion.spotify import SpotifyIngestor

        mock_client = MagicMock()
        mock_client.artist_albums.return_value = {
            'items': [{'id': 'album1', 'name': 'Album 1'}],
            'next': None
        }
        # Simulate API error on album_tracks
        mock_client.album_tracks.side_effect = Exception("API rate limit exceeded")

        mock_repo = MagicMock()

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            with patch('spotipy.Spotify', return_value=mock_client):
                with patch('spotipy.oauth2.SpotifyClientCredentials'):
                    ingestor = SpotifyIngestor(mock_db_session)
                    ingestor.sp = mock_client

                    # Should not raise, but return empty list
                    track_ids = ingestor.ingest_artist_albums("test_artist")

        assert track_ids == []


class TestSpotifyPlaybackLinks:
    """Tests for playback link creation."""

    @pytest.mark.e2e
    def test_spotify_link_is_created(
        self, mock_db_session, mock_spotify_client, mock_spotify_credentials, e2e_env_vars
    ):
        """Test: Spotify playback link is created for ingested track."""
        from app.workers.ingestion.spotify import SpotifyIngestor

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.processing_status = "PENDING"
        mock_repo.create_track.return_value = mock_track

        with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
            ingestor = SpotifyIngestor(mock_db_session)
            ingestor.sp = mock_spotify_client

            ingestor.ingest_tracks_from_list([
                mock_spotify_client.track.return_value
            ])

        # Verify Spotify link was added
        mock_repo.add_playback_link.assert_called_once()
        call_args = mock_repo.add_playback_link.call_args
        assert call_args.kwargs['platform'] == 'spotify'


class TestSpotifyTaskIntegration:
    """Tests for Celery task integration with Spotify ingestion."""

    @pytest.mark.e2e
    def test_ingest_playlist_task_calls_ingestor(
        self, mock_db_session, mock_spotify_client, mock_spotify_credentials, e2e_env_vars
    ):
        """Test: ingest_playlist_task correctly calls SpotifyIngestor."""
        from app.workers.tasks_light import ingest_playlist_task

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.processing_status = "PENDING"
        mock_repo.create_track.return_value = mock_track

        with patch('app.core.database.SessionLocal', return_value=mock_db_session):
            with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
                with patch('spotipy.Spotify', return_value=mock_spotify_client):
                    with patch('spotipy.oauth2.SpotifyClientCredentials'):
                        result = ingest_playlist_task.apply(
                            args=["test_playlist_id"]
                        ).get()

        assert result['status'] == 'success'
        assert 'tracks_queued' in result

    @pytest.mark.e2e
    def test_ingest_album_task_calls_ingestor(
        self, mock_db_session, mock_spotify_client, mock_spotify_credentials, e2e_env_vars
    ):
        """Test: ingest_album_task correctly calls SpotifyIngestor."""
        from app.workers.tasks_light import ingest_album_task

        mock_repo = MagicMock()
        mock_repo.get_by_isrc.return_value = None

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.processing_status = "PENDING"
        mock_repo.create_track.return_value = mock_track

        with patch('app.core.database.SessionLocal', return_value=mock_db_session):
            with patch('app.workers.ingestion.spotify.TrackRepository', return_value=mock_repo):
                with patch('spotipy.Spotify', return_value=mock_spotify_client):
                    with patch('spotipy.oauth2.SpotifyClientCredentials'):
                        result = ingest_album_task.apply(
                            args=["test_album_id"]
                        ).get()

        assert result['status'] == 'success'
        assert 'tracks_queued' in result
