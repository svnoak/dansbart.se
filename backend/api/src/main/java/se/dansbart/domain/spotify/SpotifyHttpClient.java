package se.dansbart.domain.spotify;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Thin HTTP client for the Spotify Web API using the Client Credentials flow.
 * Fetches a token on first use and refreshes it when it expires.
 */
@Component
@Slf4j
public class SpotifyHttpClient {

    private static final String ACCOUNTS_URL = "https://accounts.spotify.com";
    private static final String API_URL = "https://api.spotify.com/v1";

    private final RestClient accountsClient;
    private final RestClient apiClient;

    private final String clientId;
    private final String clientSecret;

    private String accessToken;
    private Instant tokenExpiry = Instant.EPOCH;

    public SpotifyHttpClient(
            @Value("${dansbart.spotify.client-id:}") String clientId,
            @Value("${dansbart.spotify.client-secret:}") String clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.accountsClient = RestClient.builder().baseUrl(ACCOUNTS_URL).build();
        this.apiClient = RestClient.builder().baseUrl(API_URL).build();
    }

    public record SpotifyAlbum(String id, String name, int totalTracks) {}
    public record SpotifyTrack(String id, String name) {}
    public record SpotifyTrackDetails(String id, String name, List<String> artistNames, Integer durationMs, String isrc) {}

    /** Spotify did not hand out an access token, so no request could be made. */
    public static class SpotifyUnavailableException extends RuntimeException {
        public SpotifyUnavailableException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    /**
     * Returns one track's name, artists, duration and ISRC.
     */
    public SpotifyTrackDetails getTrack(String trackId) {
        String token = getToken();
        @SuppressWarnings("unchecked")
        Map<String, Object> track = apiClient.get()
                .uri("/tracks/{id}", trackId)
                .header("Authorization", "Bearer " + token)
                .retrieve()
                .body(Map.class);
        if (track == null) return null;

        List<String> artistNames = new ArrayList<>();
        if (track.get("artists") instanceof List<?> artists) {
            for (Object a : artists) {
                if (a instanceof Map<?, ?> artist && artist.get("name") instanceof String name) {
                    artistNames.add(name);
                }
            }
        }
        Integer durationMs = track.get("duration_ms") instanceof Number n ? n.intValue() : null;
        String isrc = track.get("external_ids") instanceof Map<?, ?> ids && ids.get("isrc") instanceof String s && !s.isBlank()
                ? s : null;
        return new SpotifyTrackDetails((String) track.get("id"), (String) track.get("name"), artistNames, durationMs, isrc);
    }

    /**
     * Returns albums for an artist, excluding compilations.
     */
    public List<SpotifyAlbum> getArtistAlbums(String artistId) {
        String token = getToken();
        List<SpotifyAlbum> albums = new ArrayList<>();
        String path = "/artists/" + artistId + "/albums?include_groups=album,single&limit=50";

        while (path != null) {
            @SuppressWarnings("unchecked")
            Map<String, Object> page = apiClient.get()
                    .uri(path)
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .body(Map.class);

            if (page == null) break;

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = (List<Map<String, Object>>) page.get("items");
            if (items != null) {
                for (Map<String, Object> item : items) {
                    String id = (String) item.get("id");
                    String name = (String) item.get("name");
                    int totalTracks = item.get("total_tracks") instanceof Number n
                            ? n.intValue() : 0;
                    if (id != null) albums.add(new SpotifyAlbum(id, name, totalTracks));
                }
            }

            String next = (String) page.get("next");
            // Strip base URL from next href so we use path only
            path = next != null ? next.replace(API_URL, "") : null;
        }

        return albums;
    }

    /**
     * Returns tracks for an album.
     */
    public List<SpotifyTrack> getAlbumTracks(String albumId) {
        String token = getToken();
        List<SpotifyTrack> tracks = new ArrayList<>();
        String path = "/albums/" + albumId + "/tracks?limit=50";

        while (path != null) {
            @SuppressWarnings("unchecked")
            Map<String, Object> page = apiClient.get()
                    .uri(path)
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .body(Map.class);

            if (page == null) break;

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = (List<Map<String, Object>>) page.get("items");
            if (items != null) {
                for (Map<String, Object> item : items) {
                    String id = (String) item.get("id");
                    String name = (String) item.get("name");
                    if (id != null) tracks.add(new SpotifyTrack(id, name != null ? name : ""));
                }
            }

            String next = (String) page.get("next");
            path = next != null ? next.replace(API_URL, "") : null;
        }

        return tracks;
    }

    // ---------------------------------------------------------------- import

    public record SpotifyArtistRef(String id, String name) {}

    public record SpotifyAlbumRef(String id, String name, String coverUrl, String releaseDate,
                                  List<SpotifyArtistRef> artists) {}

    /** A track as an import stores it. The ISRC is null for tracks read from an album's track list. */
    public record SpotifyImportTrack(String id, String name, Integer durationMs, String isrc,
                                     List<SpotifyArtistRef> artists, SpotifyAlbumRef album) {}

    public record SpotifyImportAlbum(SpotifyAlbumRef album, List<SpotifyImportTrack> tracks) {}

    /** One track with its album and artists, for an import. */
    public SpotifyImportTrack getTrackForImport(String trackId) {
        Map<String, Object> track = getJson("/tracks/" + trackId);
        return track != null ? toImportTrack(track, null) : null;
    }

    /**
     * An album and all its tracks. The album's track list has no ISRCs, and Spotify no
     * longer offers a batch lookup that would add them.
     */
    @SuppressWarnings("unchecked")
    public SpotifyImportAlbum getAlbumForImport(String albumId) {
        Map<String, Object> body = getJson("/albums/" + albumId);
        if (body == null) return null;
        SpotifyAlbumRef album = toAlbumRef(body);
        List<SpotifyImportTrack> tracks = new ArrayList<>();
        Map<String, Object> page = body.get("tracks") instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
        while (page != null) {
            if (page.get("items") instanceof List<?> items) {
                for (Object item : items) {
                    if (item instanceof Map<?, ?> t && t.get("id") != null) {
                        tracks.add(toImportTrack((Map<String, Object>) t, album));
                    }
                }
            }
            page = page.get("next") instanceof String next ? getJson(next.replace(API_URL, "")) : null;
        }
        return new SpotifyImportAlbum(album, tracks);
    }

    /** The music tracks of a playlist. Local files, episodes and removed tracks are left out. */
    @SuppressWarnings("unchecked")
    public List<SpotifyImportTrack> getPlaylistTracksForImport(String playlistId) {
        List<SpotifyImportTrack> tracks = new ArrayList<>();
        String path = "/playlists/" + playlistId + "/items?limit=50";
        while (path != null) {
            Map<String, Object> page = getJson(path);
            if (page == null) break;
            if (page.get("items") instanceof List<?> items) {
                for (Object entry : items) {
                    if (!(entry instanceof Map<?, ?> e) || Boolean.TRUE.equals(e.get("is_local"))) continue;
                    // Spotify renamed the field from "track" to "item" in 2026.
                    Object t = e.get("item") != null ? e.get("item") : e.get("track");
                    if (t instanceof Map<?, ?> track && track.get("id") != null
                            && (track.get("type") == null || "track".equals(track.get("type")))) {
                        tracks.add(toImportTrack((Map<String, Object>) track, null));
                    }
                }
            }
            path = page.get("next") instanceof String next ? next.replace(API_URL, "") : null;
        }
        return tracks;
    }

    @SuppressWarnings("unchecked")
    private SpotifyImportTrack toImportTrack(Map<String, Object> track, SpotifyAlbumRef album) {
        SpotifyAlbumRef albumRef = album;
        if (albumRef == null && track.get("album") instanceof Map<?, ?> a) {
            albumRef = toAlbumRef((Map<String, Object>) a);
        }
        Integer durationMs = track.get("duration_ms") instanceof Number n ? n.intValue() : null;
        String isrc = track.get("external_ids") instanceof Map<?, ?> ids && ids.get("isrc") instanceof String s && !s.isBlank()
                ? s : null;
        return new SpotifyImportTrack((String) track.get("id"), (String) track.get("name"), durationMs, isrc,
                toArtistRefs(track.get("artists")), albumRef);
    }

    @SuppressWarnings("unchecked")
    private SpotifyAlbumRef toAlbumRef(Map<String, Object> album) {
        String cover = null;
        if (album.get("images") instanceof List<?> images && !images.isEmpty()
                && images.get(0) instanceof Map<?, ?> image && image.get("url") instanceof String url) {
            cover = url;
        }
        return new SpotifyAlbumRef((String) album.get("id"), (String) album.get("name"), cover,
                album.get("release_date") instanceof String d ? d : null, toArtistRefs(album.get("artists")));
    }

    private static List<SpotifyArtistRef> toArtistRefs(Object artists) {
        List<SpotifyArtistRef> refs = new ArrayList<>();
        if (artists instanceof List<?> list) {
            for (Object a : list) {
                if (a instanceof Map<?, ?> artist && artist.get("name") instanceof String name && !name.isBlank()) {
                    refs.add(new SpotifyArtistRef(artist.get("id") instanceof String id ? id : null, name));
                }
            }
        }
        return refs;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getJson(String path) {
        String token = getToken();
        return apiClient.get()
                .uri(path)
                .header("Authorization", "Bearer " + token)
                .retrieve()
                .body(Map.class);
    }

    private synchronized String getToken() {
        if (accessToken != null && Instant.now().isBefore(tokenExpiry)) {
            return accessToken;
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "client_credentials");

        Map<String, Object> response;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> body = accountsClient.post()
                    .uri("/api/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .headers(h -> h.setBasicAuth(clientId, clientSecret))
                    .body(form)
                    .retrieve()
                    .body(Map.class);
            response = body;
        } catch (RestClientException e) {
            // Without this, a refused client id answers 400 like an unknown track would.
            throw new SpotifyUnavailableException("Could not obtain a Spotify token: " + e.getMessage(), e);
        }

        if (response == null) throw new SpotifyUnavailableException("Spotify returned no token", null);

        accessToken = (String) response.get("access_token");
        int expiresIn = response.get("expires_in") instanceof Number n ? n.intValue() : 3600;
        // Refresh 60 seconds early
        tokenExpiry = Instant.now().plusSeconds(expiresIn - 60);

        log.debug("Obtained new Spotify access token, expires in {}s", expiresIn);
        return accessToken;
    }
}
