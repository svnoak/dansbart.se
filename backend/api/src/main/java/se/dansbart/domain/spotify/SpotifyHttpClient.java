package se.dansbart.domain.spotify;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import se.dansbart.exception.ExternalServiceException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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
    /** artistName and albumName are filled when the response carries them, else null. */
    public record SpotifyTrack(String id, String name, String artistName, String albumName) {
        public SpotifyTrack(String id, String name) {
            this(id, name, null, null);
        }
    }

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank() && clientSecret != null && !clientSecret.isBlank();
    }

    /** One track, or empty when Spotify has no track with that id. */
    public Optional<SpotifyTrack> getTrack(String trackId) {
        Map<String, Object> body = getOrNull("/tracks/" + trackId);
        return body == null ? Optional.empty() : Optional.ofNullable(toTrack(body));
    }

    public Optional<SpotifyAlbum> getAlbum(String albumId) {
        Map<String, Object> body = getOrNull("/albums/" + albumId);
        if (body == null) return Optional.empty();
        int total = body.get("total_tracks") instanceof Number n ? n.intValue() : 0;
        return Optional.of(new SpotifyAlbum((String) body.get("id"), (String) body.get("name"), total));
    }

    public Optional<String> getArtistName(String artistId) {
        Map<String, Object> body = getOrNull("/artists/" + artistId);
        return body == null ? Optional.empty() : Optional.ofNullable((String) body.get("name"));
    }

    public Optional<String> getPlaylistName(String playlistId) {
        Map<String, Object> body = getOrNull("/playlists/" + playlistId + "?fields=name");
        return body == null ? Optional.empty() : Optional.ofNullable((String) body.get("name"));
    }

    /** The playlist's tracks in order, skipping local files and episodes, at most {@code max}. */
    public List<SpotifyTrack> getPlaylistTracks(String playlistId, int max) {
        List<SpotifyTrack> tracks = new ArrayList<>();
        String path = "/playlists/" + playlistId
            + "/tracks?fields=next,items(track(id,name,type,is_local,artists(name),album(name)))&limit=100";
        while (path != null && tracks.size() < max) {
            Map<String, Object> page = getOrNull(path);
            if (page == null) break;
            for (Map<String, Object> item : listOfMaps(page.get("items"))) {
                if (!(item.get("track") instanceof Map<?, ?> raw)) continue;
                @SuppressWarnings("unchecked")
                Map<String, Object> t = (Map<String, Object>) raw;
                if (Boolean.TRUE.equals(t.get("is_local"))) continue;
                if (t.get("type") != null && !"track".equals(t.get("type"))) continue;
                SpotifyTrack track = toTrack(t);
                if (track != null && tracks.size() < max) tracks.add(track);
            }
            String next = (String) page.get("next");
            path = next != null ? next.replace(API_URL, "") : null;
        }
        return tracks;
    }

    private static SpotifyTrack toTrack(Map<String, Object> t) {
        if (!(t.get("id") instanceof String id)) return null;
        List<Map<String, Object>> artists = listOfMaps(t.get("artists"));
        String artistName = artists.isEmpty() ? null : (String) artists.get(0).get("name");
        String albumName = t.get("album") instanceof Map<?, ?> album ? (String) album.get("name") : null;
        return new SpotifyTrack(id, t.get("name") instanceof String name ? name : "", artistName, albumName);
    }

    /** GET a path; null on 404, {@link ExternalServiceException} when Spotify is unreachable or unconfigured. */
    private Map<String, Object> getOrNull(String path) {
        if (!isConfigured()) {
            throw new ExternalServiceException("Spotify is not configured on this server");
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> body = apiClient.get()
                    .uri(path)
                    .header("Authorization", "Bearer " + getToken())
                    .retrieve()
                    .body(Map.class);
            return body;
        } catch (HttpClientErrorException.NotFound e) {
            return null;
        } catch (RestClientException e) {
            throw new ExternalServiceException("Spotify request failed", e);
        }
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> listOfMaps(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> m) out.add((Map<String, Object>) m);
        }
        return out;
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
                    SpotifyTrack track = toTrack(item);
                    if (track != null) tracks.add(track);
                }
            }

            String next = (String) page.get("next");
            path = next != null ? next.replace(API_URL, "") : null;
        }

        return tracks;
    }

    private synchronized String getToken() {
        if (accessToken != null && Instant.now().isBefore(tokenExpiry)) {
            return accessToken;
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "client_credentials");

        @SuppressWarnings("unchecked")
        Map<String, Object> response = accountsClient.post()
                .uri("/api/token")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .headers(h -> h.setBasicAuth(clientId, clientSecret))
                .body(form)
                .retrieve()
                .body(Map.class);

        if (response == null) throw new RuntimeException("Failed to obtain Spotify token");

        accessToken = (String) response.get("access_token");
        int expiresIn = response.get("expires_in") instanceof Number n ? n.intValue() : 3600;
        // Refresh 60 seconds early
        tokenExpiry = Instant.now().plusSeconds(expiresIn - 60);

        log.debug("Obtained new Spotify access token, expires in {}s", expiresIn);
        return accessToken;
    }
}
