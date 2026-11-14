package se.dansbart.domain.spotify;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Service for Spotify preview and ingestion operations.
 * Previews fetch data directly from the Spotify API synchronously.
 * Imports are done by {@link SpotifyImportService}, in the API, without the workers.
 * The imports are for admins only (see the security configuration).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SpotifyIngestService {

    private final SpotifyHttpClient spotifyHttpClient;
    private final SpotifyImportService importService;

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

    /** Imports an album from Spotify. See {@link SpotifyImportService}. */
    public Map<String, Object> ingestAlbum(String spotifyAlbumId) {
        return importService.importAlbum(spotifyAlbumId).toResponse();
    }

    /** Imports a single track from Spotify. See {@link SpotifyImportService}. */
    public Map<String, Object> ingestTrack(String spotifyTrackId) {
        return importService.importTrack(spotifyTrackId).toResponse();
    }
}
