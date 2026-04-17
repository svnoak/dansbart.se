package se.dansbart.domain.admin.spotify;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import se.dansbart.worker.TaskDispatcher;

import java.util.*;

/**
 * Service for Spotify preview and ingestion operations.
 * Previews fetch data directly from the Spotify API synchronously.
 * Ingestions queue tracks for background processing via Celery workers.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminSpotifyService {

    private final TaskDispatcher taskDispatcher;
    private final SpotifyHttpClient spotifyHttpClient;

    /**
     * Preview an artist's albums directly from Spotify.
     * Returns album metadata without ingesting any tracks.
     */
    public List<Map<String, Object>> getArtistAlbums(String spotifyArtistId) {
        List<SpotifyHttpClient.SpotifyAlbum> albums = spotifyHttpClient.getArtistAlbums(spotifyArtistId);
        return albums.stream().map(a -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", a.id());
            item.put("name", a.name());
            item.put("totalTracks", a.totalTracks());
            return item;
        }).toList();
    }

    /**
     * Preview an album's tracks directly from Spotify.
     * Returns track metadata without ingesting them.
     */
    public List<Map<String, Object>> getAlbumTracks(String spotifyAlbumId) {
        List<SpotifyHttpClient.SpotifyTrack> tracks = spotifyHttpClient.getAlbumTracks(spotifyAlbumId);
        return tracks.stream().map(t -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", t.id());
            item.put("name", t.name());
            return item;
        }).toList();
    }

    /**
     * Ingest an album from Spotify.
     * Queues all tracks from the album for full processing.
     */
    public Map<String, Object> ingestAlbum(String spotifyAlbumId) {
        taskDispatcher.dispatchSpotifyIngest("album", spotifyAlbumId);
        Map<String, Object> result = new HashMap<>();
        result.put("status", "queued");
        result.put("spotifyAlbumId", spotifyAlbumId);
        result.put("message", "Album ingestion queued");
        return result;
    }

    /**
     * Ingest a single track from Spotify.
     */
    public Map<String, Object> ingestTrack(String spotifyTrackId) {
        taskDispatcher.dispatchSpotifyIngest("track", spotifyTrackId);
        Map<String, Object> result = new HashMap<>();
        result.put("status", "queued");
        result.put("spotifyTrackId", spotifyTrackId);
        result.put("message", "Track ingestion queued");
        return result;
    }
}
