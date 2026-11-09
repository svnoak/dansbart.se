package se.dansbart.domain.contribution;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Turns a pasted YouTube or Spotify link into a source and an id.
 * Only single tracks are accepted: no playlists, albums or channels.
 */
public final class TrackLinkParser {

    public enum Source { YOUTUBE, SPOTIFY }

    public record ParsedLink(Source source, String externalId) {}

    private static final Pattern YOUTUBE_ID = Pattern.compile("^[A-Za-z0-9_-]{11}$");
    private static final Pattern SPOTIFY_ID = Pattern.compile("^[A-Za-z0-9]{22}$");
    private static final Pattern SPOTIFY_URI = Pattern.compile("^spotify:track:([A-Za-z0-9]{22})$");

    private TrackLinkParser() {}

    public static Optional<ParsedLink> parse(String input) {
        if (input == null) return Optional.empty();
        String raw = input.trim();
        if (raw.isEmpty()) return Optional.empty();

        var spotifyUri = SPOTIFY_URI.matcher(raw);
        if (spotifyUri.matches()) {
            return Optional.of(new ParsedLink(Source.SPOTIFY, spotifyUri.group(1)));
        }

        if (!raw.contains("://")) raw = "https://" + raw;
        URI uri;
        try {
            uri = new URI(raw);
        } catch (URISyntaxException e) {
            return Optional.empty();
        }
        String host = uri.getHost();
        if (host == null) return Optional.empty();
        host = host.toLowerCase();
        if (host.startsWith("www.")) host = host.substring(4);
        String path = uri.getPath() != null ? uri.getPath() : "";
        String[] segments = path.replaceAll("^/+", "").split("/");

        switch (host) {
            case "youtu.be" -> {
                return youtube(segments.length > 0 ? segments[0] : null);
            }
            case "youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com" -> {
                if ("watch".equals(segments[0])) {
                    return youtube(queryParam(uri.getRawQuery(), "v"));
                }
                if (segments.length >= 2 && ("shorts".equals(segments[0]) || "embed".equals(segments[0])
                        || "live".equals(segments[0]) || "v".equals(segments[0]))) {
                    return youtube(segments[1]);
                }
                return Optional.empty();
            }
            case "open.spotify.com", "play.spotify.com" -> {
                // Links may carry a locale prefix: /intl-sv/track/{id}
                for (int i = 0; i < segments.length - 1; i++) {
                    if ("track".equals(segments[i])) {
                        String id = segments[i + 1];
                        return SPOTIFY_ID.matcher(id).matches()
                            ? Optional.of(new ParsedLink(Source.SPOTIFY, id))
                            : Optional.empty();
                    }
                }
                return Optional.empty();
            }
            default -> {
                return Optional.empty();
            }
        }
    }

    private static Optional<ParsedLink> youtube(String id) {
        return id != null && YOUTUBE_ID.matcher(id).matches()
            ? Optional.of(new ParsedLink(Source.YOUTUBE, id))
            : Optional.empty();
    }

    private static String queryParam(String query, String name) {
        if (query == null) return null;
        for (String pair : query.split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0 && pair.substring(0, eq).equals(name)) {
                return pair.substring(eq + 1);
            }
        }
        return null;
    }
}
