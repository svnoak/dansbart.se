"""YouTube audio source adapter for neckenml analyzer - PROPRIETARY"""

from neckenml.sources import AudioSource
from .fetcher import AudioFetcher
from sqlalchemy.orm import Session


class YouTubeAudioSource(AudioSource):
    """
    Proprietary audio source that fetches audio from YouTube.

    This adapter bridges the open-source neckenml-analyzer package
    with dansbart.se's proprietary YouTube acquisition system.
    """

    def __init__(self, db_session: Session):
        """
        Initialize YouTube audio source.

        Args:
            db_session: SQLAlchemy database session for fetcher
        """
        self.fetcher = AudioFetcher(db_session)
        self.db = db_session

    def fetch_audio(self, track_id: str) -> str:
        """
        Fetch audio from YouTube for the given track ID.

        Args:
            track_id: Track database ID (integer as string or UUID)

        Returns:
            str: Local file path to downloaded MP3

        Raises:
            Exception: If YouTube fetching fails
        """
        # Convert track_id to int if it's a number
        try:
            track_id_int = int(track_id)
        except ValueError:
            # Might be a UUID string, handle accordingly
            track_id_int = track_id

        # Use existing YouTube fetcher
        result = self.fetcher.fetch_track_audio(track_id=track_id_int)

        if not result or 'file_path' not in result:
            raise Exception(f"Failed to fetch audio for track {track_id}")

        return result['file_path']

    def cleanup(self, file_path: str) -> None:
        """
        Clean up temporary YouTube downloads.

        Args:
            file_path: Path to the temporary audio file
        """
        import os

        # YouTube downloads are temporary, safe to delete
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError as e:
                # Log but don't crash if cleanup fails
                print(f"⚠️ Failed to clean up {file_path}: {e}")
