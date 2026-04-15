package se.dansbart.domain.admin.spotify;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

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
