package se.dansbart.domain.admin.spotify;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import se.dansbart.worker.TaskDispatcher;

import java.util.*;

/**
 * Service for Spotify preview and ingestion operations.
 * Previews fetch data from Spotify API, while ingestions queue tracks for processing.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminSpotifyService {

    private final TaskDispatcher taskDispatcher;

    /**
     * Preview an artist's albums from Spotify.
     * This fetches album metadata without ingesting tracks.
     */
    public Map<String, Object> getArtistAlbums(String spotifyArtistId) {
        String taskId = UUID.randomUUID().toString();

        // Dispatch preview task to light worker
        taskDispatcher.dispatchSpotifyPreview("artist_albums", spotifyArtistId);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "queued");
        result.put("taskId", taskId);
        result.put("spotifyArtistId", spotifyArtistId);
        result.put("message", "Artist albums preview queued");
        return result;
    }

    /**
     * Preview an album's tracks from Spotify.
     * This fetches track metadata without ingesting them.
     */
    public Map<String, Object> getAlbumTracks(String spotifyAlbumId) {
        String taskId = UUID.randomUUID().toString();

        // Dispatch preview task to light worker
        taskDispatcher.dispatchSpotifyPreview("album_tracks", spotifyAlbumId);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "queued");
        result.put("taskId", taskId);
        result.put("spotifyAlbumId", spotifyAlbumId);
        result.put("message", "Album tracks preview queued");
        return result;
    }

    /**
     * Ingest an album from Spotify.
     * This queues all tracks from the album for full processing.
     */
    public Map<String, Object> ingestAlbum(String spotifyAlbumId) {
        String taskId = UUID.randomUUID().toString();

        // Use existing ingest mechanism with album type
        taskDispatcher.dispatchSpotifyIngest("album", spotifyAlbumId);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "queued");
        result.put("taskId", taskId);
        result.put("spotifyAlbumId", spotifyAlbumId);
        result.put("message", "Album ingestion queued");
        return result;
    }

    /**
     * Ingest a single track from Spotify.
     */
    public Map<String, Object> ingestTrack(String spotifyTrackId) {
        String taskId = UUID.randomUUID().toString();

        // Dispatch track ingestion task
        taskDispatcher.dispatchSpotifyIngest("track", spotifyTrackId);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "queued");
        result.put("taskId", taskId);
        result.put("spotifyTrackId", spotifyTrackId);
        result.put("message", "Track ingestion queued");
        return result;
    }
}
