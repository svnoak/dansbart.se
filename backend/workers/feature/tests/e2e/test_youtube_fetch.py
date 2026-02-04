"""
E2E tests for YouTube audio fetching.

Tests the AudioFetcher class which downloads audio from YouTube
for analysis in the Dansbart pipeline.
"""
import pytest
from unittest.mock import patch, MagicMock, mock_open
import os
import uuid


class TestAudioFetcherSearch:
    """Tests for YouTube search functionality."""

    @pytest.mark.e2e
    def test_search_finds_matching_video(self, e2e_env_vars):
        """Test: YouTube search returns matching videos for a query."""
        from app.workers.audio.fetcher import AudioFetcher

        mock_entries = [
            {
                'id': 'video1',
                'title': 'Slängpolska från Boda - Boda Spelmanslag',
                'duration': 180,
                'channel': 'Swedish Folk Music',
                'webpage_url': 'https://youtube.com/watch?v=video1'
            },
            {
                'id': 'video2',
                'title': 'Some Other Song',
                'duration': 200,
                'channel': 'Random Channel',
                'webpage_url': 'https://youtube.com/watch?v=video2'
            }
        ]

        with patch('yt_dlp.YoutubeDL') as MockYDL:
            ydl_instance = MagicMock()
            MockYDL.return_value.__enter__.return_value = ydl_instance

            # Mock search results
            ydl_instance.extract_info.return_value = {
                'entries': mock_entries
            }

            fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
            fetcher._track_title = 'Slängpolska från Boda'
            fetcher._artist_name = 'Boda Spelmanslag'
            fetcher._expected_duration_ms = 180000

            best = fetcher._find_best_match(mock_entries, 180000)

        assert best is not None
        assert best['id'] == 'video1'

    @pytest.mark.e2e
    def test_search_rejects_karaoke_versions(self, e2e_env_vars):
        """Test: Karaoke versions are filtered out from search results."""
        from app.workers.audio.fetcher import AudioFetcher

        mock_entries = [
            {
                'id': 'karaoke1',
                'title': 'Slängpolska - KARAOKE VERSION',
                'duration': 180,
                'channel': 'Karaoke Channel',
                'webpage_url': 'https://youtube.com/watch?v=karaoke1'
            }
        ]

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
        fetcher._track_title = 'Slängpolska'
        fetcher._artist_name = 'Test Artist'
        fetcher._expected_duration_ms = 180000

        best = fetcher._find_best_match(mock_entries, 180000)

        # Should reject karaoke version
        assert best is None

    @pytest.mark.e2e
    def test_search_rejects_live_recordings(self, e2e_env_vars):
        """Test: Live recordings are filtered out unless in original title."""
        from app.workers.audio.fetcher import AudioFetcher

        mock_entries = [
            {
                'id': 'live1',
                'title': 'Slängpolska - LIVE at Festival',
                'duration': 180,
                'channel': 'Folk Music Channel',
                'webpage_url': 'https://youtube.com/watch?v=live1'
            }
        ]

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
        fetcher._track_title = 'Slängpolska'  # No "live" in original
        fetcher._artist_name = 'Test Artist'
        fetcher._expected_duration_ms = 180000

        best = fetcher._find_best_match(mock_entries, 180000)

        assert best is None

    @pytest.mark.e2e
    def test_search_accepts_live_when_in_original(self, e2e_env_vars):
        """Test: Live recordings are accepted when original title contains 'live'."""
        from app.workers.audio.fetcher import AudioFetcher

        mock_entries = [
            {
                'id': 'live1',
                'title': 'Slängpolska Live - Boda Spelmanslag',
                'duration': 180,
                'channel': 'Folk Music Channel',
                'webpage_url': 'https://youtube.com/watch?v=live1'
            }
        ]

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
        fetcher._track_title = 'Slängpolska Live'  # "live" is in original
        fetcher._artist_name = 'Boda Spelmanslag'
        fetcher._expected_duration_ms = 180000

        best = fetcher._find_best_match(mock_entries, 180000)

        assert best is not None

    @pytest.mark.e2e
    def test_search_rejects_very_short_videos(self, e2e_env_vars):
        """Test: Very short videos (<60s) are filtered out."""
        from app.workers.audio.fetcher import AudioFetcher

        mock_entries = [
            {
                'id': 'short1',
                'title': 'Slängpolska - Preview',
                'duration': 30,  # Too short
                'channel': 'Folk Music',
                'webpage_url': 'https://youtube.com/watch?v=short1'
            }
        ]

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
        fetcher._track_title = 'Slängpolska'
        fetcher._artist_name = 'Test Artist'
        fetcher._expected_duration_ms = 180000

        best = fetcher._find_best_match(mock_entries, 180000)

        assert best is None

    @pytest.mark.e2e
    def test_search_rejects_very_long_videos(self, e2e_env_vars):
        """Test: Very long videos (>600s) are filtered out."""
        from app.workers.audio.fetcher import AudioFetcher

        mock_entries = [
            {
                'id': 'long1',
                'title': 'Slängpolska - Full Album',
                'duration': 3600,  # Too long (1 hour)
                'channel': 'Folk Music',
                'webpage_url': 'https://youtube.com/watch?v=long1'
            }
        ]

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
        fetcher._track_title = 'Slängpolska'
        fetcher._artist_name = 'Test Artist'
        fetcher._expected_duration_ms = 180000

        best = fetcher._find_best_match(mock_entries, 180000)

        assert best is None


class TestAudioFetcherDownload:
    """Tests for YouTube download functionality."""

    @pytest.mark.e2e
    def test_direct_download_with_video_id(self, e2e_env_vars):
        """Test: Direct download works when video ID is provided."""
        from app.workers.audio.fetcher import AudioFetcher

        track_id = str(uuid.uuid4())

        with patch('yt_dlp.YoutubeDL') as MockYDL:
            ydl_instance = MagicMock()
            MockYDL.return_value.__enter__.return_value = ydl_instance

            ydl_instance.extract_info.return_value = {
                'id': 'dQw4w9WgXcQ',
                'title': 'Test Video'
            }

            # Mock file exists after download
            with patch('os.path.exists', return_value=True):
                with patch.object(AudioFetcher, '_verify_downloaded_audio') as mock_verify:
                    mock_verify.return_value = {
                        'valid': True,
                        'actual_duration_ms': 180000,
                        'reason': 'Duration match'
                    }

                    fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
                    result = fetcher.fetch_track_audio(
                        track_id=track_id,
                        query="",
                        expected_duration_ms=180000,
                        track_title="Test Track",
                        artist_name="Test Artist",
                        direct_video_id="dQw4w9WgXcQ"
                    )

        assert result is not None
        assert result['youtube_id'] == 'dQw4w9WgXcQ'

    @pytest.mark.e2e
    def test_search_and_download_flow(self, e2e_env_vars):
        """Test: Full search and download flow works correctly."""
        from app.workers.audio.fetcher import AudioFetcher

        track_id = str(uuid.uuid4())

        mock_entries = [
            {
                'id': 'video1',
                'title': 'Slängpolska från Boda - Boda Spelmanslag',
                'duration': 180,
                'channel': 'Swedish Folk Music',
                'webpage_url': 'https://youtube.com/watch?v=video1'
            }
        ]

        with patch('yt_dlp.YoutubeDL') as MockYDL:
            ydl_instance = MagicMock()
            MockYDL.return_value.__enter__.return_value = ydl_instance

            # First call: search results
            # Second call: full video info
            ydl_instance.extract_info.side_effect = [
                {'entries': mock_entries},
                {
                    'id': 'video1',
                    'title': 'Slängpolska från Boda - Boda Spelmanslag',
                    'webpage_url': 'https://youtube.com/watch?v=video1'
                }
            ]

            with patch('os.path.exists', return_value=True):
                with patch.object(AudioFetcher, '_verify_downloaded_audio') as mock_verify:
                    mock_verify.return_value = {
                        'valid': True,
                        'actual_duration_ms': 180000,
                        'reason': 'Duration match'
                    }

                    fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
                    result = fetcher.fetch_track_audio(
                        track_id=track_id,
                        query="Boda Spelmanslag - Slängpolska från Boda",
                        expected_duration_ms=180000,
                        track_title="Slängpolska från Boda",
                        artist_name="Boda Spelmanslag"
                    )

        assert result is not None
        assert result['youtube_id'] == 'video1'
        assert result['verified'] is True

    @pytest.mark.e2e
    def test_download_returns_none_on_no_results(self, e2e_env_vars):
        """Test: Returns None when no search results found."""
        from app.workers.audio.fetcher import AudioFetcher

        track_id = str(uuid.uuid4())

        with patch('yt_dlp.YoutubeDL') as MockYDL:
            ydl_instance = MagicMock()
            MockYDL.return_value.__enter__.return_value = ydl_instance

            # No results
            ydl_instance.extract_info.return_value = {'entries': []}

            fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
            result = fetcher.fetch_track_audio(
                track_id=track_id,
                query="Nonexistent Track",
                expected_duration_ms=180000,
                track_title="Nonexistent Track",
                artist_name="Unknown Artist"
            )

        assert result is None

    @pytest.mark.e2e
    def test_download_handles_api_error(self, e2e_env_vars):
        """Test: API errors are handled gracefully."""
        from app.workers.audio.fetcher import AudioFetcher

        track_id = str(uuid.uuid4())

        with patch('yt_dlp.YoutubeDL') as MockYDL:
            ydl_instance = MagicMock()
            MockYDL.return_value.__enter__.return_value = ydl_instance

            # Simulate API error
            ydl_instance.extract_info.side_effect = Exception("Network error")

            fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
            result = fetcher.fetch_track_audio(
                track_id=track_id,
                query="Test Query",
                expected_duration_ms=180000,
                track_title="Test Track",
                artist_name="Test Artist"
            )

        assert result is None


class TestAudioFetcherVerification:
    """Tests for audio verification functionality."""

    @pytest.mark.e2e
    def test_verify_audio_with_matching_duration(self, e2e_env_vars):
        """Test: Audio with matching duration passes verification."""
        from app.workers.audio.fetcher import AudioFetcher

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
        fetcher._expected_duration_ms = 180000

        # Mock MP3 file
        mock_mp3 = MagicMock()
        mock_mp3.info.length = 180  # 180 seconds

        with patch('os.path.exists', return_value=True):
            with patch('mutagen.mp3.MP3', return_value=mock_mp3):
                result = fetcher._verify_downloaded_audio('/tmp/test.mp3')

        assert result['valid'] is True
        assert result['actual_duration_ms'] == 180000

    @pytest.mark.e2e
    def test_verify_audio_with_mismatched_duration(self, e2e_env_vars):
        """Test: Audio with significantly different duration fails verification."""
        from app.workers.audio.fetcher import AudioFetcher

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
        fetcher._expected_duration_ms = 180000  # 3 minutes

        # Mock MP3 file with very different duration
        mock_mp3 = MagicMock()
        mock_mp3.info.length = 300  # 5 minutes - 2 minute difference

        with patch('os.path.exists', return_value=True):
            with patch('mutagen.mp3.MP3', return_value=mock_mp3):
                result = fetcher._verify_downloaded_audio('/tmp/test.mp3')

        assert result['valid'] is False
        assert 'mismatch' in result['reason'].lower()

    @pytest.mark.e2e
    def test_verify_audio_within_tolerance(self, e2e_env_vars):
        """Test: Audio within 10 second tolerance passes verification."""
        from app.workers.audio.fetcher import AudioFetcher

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
        fetcher._expected_duration_ms = 180000  # 3 minutes

        # Mock MP3 file with 8 second difference (within 10s tolerance)
        mock_mp3 = MagicMock()
        mock_mp3.info.length = 188  # 3:08 - 8 second difference

        with patch('os.path.exists', return_value=True):
            with patch('mutagen.mp3.MP3', return_value=mock_mp3):
                result = fetcher._verify_downloaded_audio('/tmp/test.mp3')

        assert result['valid'] is True

    @pytest.mark.e2e
    def test_verify_audio_file_not_found(self, e2e_env_vars):
        """Test: Missing file fails verification."""
        from app.workers.audio.fetcher import AudioFetcher

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
        fetcher._expected_duration_ms = 180000

        with patch('os.path.exists', return_value=False):
            result = fetcher._verify_downloaded_audio('/tmp/nonexistent.mp3')

        assert result['valid'] is False
        assert 'not found' in result['reason'].lower()


class TestAudioFetcherCleanup:
    """Tests for temporary file cleanup."""

    @pytest.mark.e2e
    def test_cleanup_removes_temp_files(self, e2e_env_vars):
        """Test: Cleanup removes temporary audio files."""
        from app.workers.audio.fetcher import AudioFetcher

        track_id = str(uuid.uuid4())

        with patch('glob.glob') as mock_glob:
            with patch('os.remove') as mock_remove:
                mock_glob.return_value = [
                    f'/tmp/test_audio/{track_id}.mp3',
                    f'/tmp/test_audio/{track_id}.webm'
                ]

                fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
                fetcher.cleanup(track_id)

        assert mock_remove.call_count == 2

    @pytest.mark.e2e
    def test_cleanup_handles_missing_files(self, e2e_env_vars):
        """Test: Cleanup handles missing files gracefully."""
        from app.workers.audio.fetcher import AudioFetcher

        track_id = str(uuid.uuid4())

        with patch('glob.glob', return_value=[]):
            # Should not raise
            fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
            fetcher.cleanup(track_id)


class TestTitleNormalization:
    """Tests for title normalization logic."""

    @pytest.mark.e2e
    def test_normalize_removes_parentheses(self, e2e_env_vars):
        """Test: Parenthetical content is removed from titles."""
        from app.workers.audio.fetcher import AudioFetcher

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')

        result = fetcher._normalize_title("Song Name (Official Audio)")

        assert 'official' not in result
        assert 'audio' not in result
        assert 'song name' in result

    @pytest.mark.e2e
    def test_normalize_removes_brackets(self, e2e_env_vars):
        """Test: Bracketed content is removed from titles."""
        from app.workers.audio.fetcher import AudioFetcher

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')

        result = fetcher._normalize_title("Song Name [HD Quality]")

        assert 'hd' not in result
        assert 'quality' not in result

    @pytest.mark.e2e
    def test_normalize_removes_video_suffixes(self, e2e_env_vars):
        """Test: Video-related suffixes are removed."""
        from app.workers.audio.fetcher import AudioFetcher

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')

        result = fetcher._normalize_title("Song Name - Official Video HD")

        assert 'official' not in result
        assert 'video' not in result
        assert 'hd' not in result

    @pytest.mark.e2e
    def test_normalize_handles_special_characters(self, e2e_env_vars):
        """Test: Special characters are handled correctly."""
        from app.workers.audio.fetcher import AudioFetcher

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')

        result = fetcher._normalize_title("Song's Name: A Test!")

        # Should be lowercased and cleaned
        assert result == 'song s name a test'


class TestScoringLogic:
    """Tests for candidate scoring logic."""

    @pytest.mark.e2e
    def test_exact_title_match_scores_high(self, e2e_env_vars):
        """Test: Exact title match receives high score."""
        from app.workers.audio.fetcher import AudioFetcher

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
        fetcher._track_title = 'Slängpolska från Boda'
        fetcher._artist_name = 'Boda Spelmanslag'
        fetcher._expected_duration_ms = 180000

        entries = [
            {
                'id': 'exact',
                'title': 'Slängpolska från Boda - Boda Spelmanslag',
                'duration': 180,
                'channel': 'Boda Spelmanslag',
                'webpage_url': 'https://youtube.com/watch?v=exact'
            },
            {
                'id': 'partial',
                'title': 'Slängpolska',
                'duration': 180,
                'channel': 'Other Channel',
                'webpage_url': 'https://youtube.com/watch?v=partial'
            }
        ]

        best = fetcher._find_best_match(entries, 180000)

        assert best is not None
        assert best['id'] == 'exact'

    @pytest.mark.e2e
    def test_duration_mismatch_lowers_score(self, e2e_env_vars):
        """Test: Duration mismatch lowers candidate score."""
        from app.workers.audio.fetcher import AudioFetcher

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
        fetcher._track_title = 'Test Track'
        fetcher._artist_name = 'Test Artist'
        fetcher._expected_duration_ms = 180000  # 3 minutes

        entries = [
            {
                'id': 'match_duration',
                'title': 'Test Track - Test Artist',
                'duration': 180,  # Exact match
                'channel': 'Test Artist',
                'webpage_url': 'https://youtube.com/watch?v=match'
            },
            {
                'id': 'wrong_duration',
                'title': 'Test Track - Test Artist',
                'duration': 300,  # 5 minutes - wrong
                'channel': 'Test Artist',
                'webpage_url': 'https://youtube.com/watch?v=wrong'
            }
        ]

        best = fetcher._find_best_match(entries, 180000)

        # Should prefer the one with matching duration
        assert best is not None
        assert best['id'] == 'match_duration'

    @pytest.mark.e2e
    def test_topic_channel_bonus(self, e2e_env_vars):
        """Test: YouTube Music 'Topic' channels get bonus score."""
        from app.workers.audio.fetcher import AudioFetcher

        fetcher = AudioFetcher(temp_dir='/tmp/test_audio')
        fetcher._track_title = 'Test Track'
        fetcher._artist_name = 'Test Artist'
        fetcher._expected_duration_ms = 180000

        entries = [
            {
                'id': 'topic',
                'title': 'Test Track',
                'duration': 180,
                'channel': 'Test Artist - Topic',  # Official topic channel
                'webpage_url': 'https://youtube.com/watch?v=topic'
            },
            {
                'id': 'random',
                'title': 'Test Track',
                'duration': 180,
                'channel': 'Random User',
                'webpage_url': 'https://youtube.com/watch?v=random'
            }
        ]

        best = fetcher._find_best_match(entries, 180000)

        # Topic channel should be preferred
        assert best is not None
        assert best['id'] == 'topic'
