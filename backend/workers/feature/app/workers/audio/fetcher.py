"""
Audio fetcher stub for the feature worker.

The actual audio downloading/analysis is performed by the separate
dansbart-audio-worker (AGPL). This module provides the interface
used by the feature worker to reference downloaded audio.
"""


class AudioFetcher:
    """
    Stub for the audio fetcher used in the feature worker context.

    Actual implementation lives in the audio-worker service.
    This class is here so feature worker code can reference the type
    without depending on the AGPL audio-worker package.
    """

    def fetch_track_audio(self, track_id, title, artist, duration_ms=None):
        raise NotImplementedError("AudioFetcher is implemented in the audio-worker service.")

    def cleanup(self, file_path):
        pass
