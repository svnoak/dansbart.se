package se.dansbart.domain.contribution;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import se.dansbart.domain.spotify.SpotifyHttpClient;

import java.util.Map;

/**
 * Looks up the title and artist behind a pasted link, so the person adding a track
 * does not have to type them. A failed lookup is not fatal: the person can type the
 * title themselves. Only a video that YouTube reports as missing or not embeddable, or a
 * track that Spotify reports as missing, is rejected. When Spotify gives no token at all,
 * the lookup is empty rather than a rejection, so a Spotify outage does not block adding.
 */
@Service
@Slf4j
public class LinkMetadataService {

    public record LinkMetadata(String title, String artistName, Integer durationMs, String isrc) {
        static final LinkMetadata EMPTY = new LinkMetadata(null, null, null, null);

        public LinkMetadata(String title, String artistName, Integer durationMs) {
            this(title, artistName, durationMs, null);
        }
    }

    /** The link points at a video that does not exist or cannot be embedded. */
    public static class UnplayableLinkException extends RuntimeException {
        public UnplayableLinkException(String message) {
            super(message);
        }
    }

    private final RestClient youtubeClient;
    private final SpotifyHttpClient spotifyHttpClient;

    public LinkMetadataService(SpotifyHttpClient spotifyHttpClient) {
        this.spotifyHttpClient = spotifyHttpClient;
        this.youtubeClient = RestClient.builder().baseUrl("https://www.youtube.com").build();
    }

    public LinkMetadata lookup(TrackLinkParser.ParsedLink link) {
        return switch (link.source()) {
            case YOUTUBE -> lookupYoutube(link.externalId());
            case SPOTIFY -> lookupSpotify(link.externalId());
        };
    }

    private LinkMetadata lookupYoutube(String videoId) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> body = youtubeClient.get()
                .uri(b -> b.path("/oembed")
                    .queryParam("url", "https://www.youtube.com/watch?v=" + videoId)
                    .queryParam("format", "json")
                    .build())
                .retrieve()
                .body(Map.class);
            if (body == null) return LinkMetadata.EMPTY;
            return new LinkMetadata(asText(body.get("title")), cleanChannelName(asText(body.get("author_name"))), null);
        } catch (RestClientResponseException e) {
            HttpStatusCode status = e.getStatusCode();
            if (status.value() == 400 || status.value() == 404) {
                throw new UnplayableLinkException("YouTube-videon finns inte.");
            }
            if (status.value() == 401 || status.value() == 403) {
                throw new UnplayableLinkException("YouTube-videon går inte att spela upp på andra webbplatser.");
            }
            log.warn("YouTube oEmbed lookup failed for {}: {}", videoId, status);
            return LinkMetadata.EMPTY;
        } catch (RestClientException e) {
            log.warn("YouTube oEmbed lookup failed for {}: {}", videoId, e.getMessage());
            return LinkMetadata.EMPTY;
        }
    }

    private LinkMetadata lookupSpotify(String trackId) {
        try {
            SpotifyHttpClient.SpotifyTrackDetails track = spotifyHttpClient.getTrack(trackId);
            if (track == null) return LinkMetadata.EMPTY;
            String artist = track.artistNames().isEmpty() ? null : String.join(", ", track.artistNames());
            return new LinkMetadata(track.name(), artist, track.durationMs(), track.isrc());
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 400 || e.getStatusCode().value() == 404) {
                throw new UnplayableLinkException("Låten finns inte på Spotify.");
            }
            log.warn("Spotify track lookup failed for {}: {}", trackId, e.getStatusCode());
            return LinkMetadata.EMPTY;
        } catch (RuntimeException e) {
            log.warn("Spotify track lookup failed for {}: {}", trackId, e.getMessage());
            return LinkMetadata.EMPTY;
        }
    }

    /** Auto-generated YouTube Music channels are named "Artist - Topic". */
    static String cleanChannelName(String name) {
        if (name == null) return null;
        return name.endsWith(" - Topic") ? name.substring(0, name.length() - " - Topic".length()) : name;
    }

    private static String asText(Object value) {
        return value instanceof String s && !s.isBlank() ? s.trim() : null;
    }
}
