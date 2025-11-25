import os
import glob
import yt_dlp
import logging

class AudioFetcher:
    def __init__(self, temp_dir="./temp_audio"):
        self.temp_dir = temp_dir
        os.makedirs(self.temp_dir, exist_ok=True)
        self.logger = logging.getLogger(__name__)

    def fetch_track_audio(self, track_id: str, query: str) -> str | None:
        """
        Downloads audio for a track and returns the file path.
        Returns None if failed.
        """
        # Clean up old files first (optional safety)
        self._cleanup(track_id)

        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': f'{self.temp_dir}/{track_id}.%(ext)s',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '128', 
            }],
            'quiet': True,
            'noplaylist': True
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                self.logger.info(f"Downloading: {query}")
                ydl.extract_info(f"ytsearch1:{query}", download=True)
                
                # Find the file (yt-dlp might output.mp3 directly)
                files = glob.glob(f"{self.temp_dir}/{track_id}.mp3")
                if files:
                    return files
        except Exception as e:
            self.logger.error(f"Download failed for {track_id}: {e}")
            return None
            
        return None

    def cleanup(self, track_id: str):
        """Public cleanup method"""
        files = glob.glob(f"{self.temp_dir}/{track_id}.*")
        for f in files:
            try:
                os.remove(f)
            except OSError:
                pass