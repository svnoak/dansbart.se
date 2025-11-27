from importlib.resources import files
import os
import glob
import yt_dlp
import logging

class AudioFetcher:
    def __init__(self, temp_dir="./temp_audio"):
        self.temp_dir = temp_dir
        os.makedirs(self.temp_dir, exist_ok=True)
        self.logger = logging.getLogger(__name__)

    # app/workers/audio/fetcher.py

    def fetch_track_audio(self, track_id: str, query: str) -> dict | None:
        """
        Downloads audio and returns a dict with file path and YouTube metadata.
        Returns None if failed.
        """
        self.cleanup(track_id)

        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': f'{self.temp_dir}/{track_id}.%(ext)s',
            'extractor_args': {'youtube': {'player_client': ['android', 'ios']}},
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '128', 
            }],
            'quiet': True,
            'noplaylist': True,
            'no_warnings': True, 
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                self.logger.info(f"Downloading: {query}")
                
                # 1. CAPTURE METADATA (download=True returns the info dict)
                info = ydl.extract_info(f"ytsearch1:{query}", download=True)
                
                # 2. EXTRACT VIDEO ID
                # ytsearch1 returns a playlist-like structure in 'entries'
                if 'entries' in info and len(info['entries']) > 0:
                    video_data = info['entries'][0]
                    youtube_id = video_data.get('id')
                    youtube_title = video_data.get('title')
                else:
                    # Fallback if structure is different
                    youtube_id = info.get('id')
                    youtube_title = info.get('title')

                # 3. VERIFY FILE EXISTENCE
                expected_file = f"{self.temp_dir}/{track_id}.mp3"
                if os.path.exists(expected_file):
                    # --- CRITICAL CHANGE HERE ---
                    # We return a DICTIONARY, not a string
                    return {
                        "file_path": expected_file,
                        "youtube_id": youtube_id,
                        "youtube_title": youtube_title
                    }
                
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