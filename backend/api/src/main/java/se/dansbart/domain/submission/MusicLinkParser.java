package se.dansbart.domain.submission;

import se.dansbart.domain.submission.MusicLink.Provider;
import se.dansbart.domain.submission.MusicLink.SourceKind;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Recognises Spotify and YouTube links to tracks, albums, artists, playlists and
 * channels. Everything else is {@link Optional#empty()} so the caller can tell the
 * person the link was not understood.
 */
public final class MusicLinkParser {

    private static final Pattern SPOTIFY_URI =
        Pattern.compile("^spotify:(track|album|artist|playlist):([A-Za-z0-9]{22})$");
    private static final Pattern SPOTIFY_PATH =
        Pattern.compile("^/(?:intl-[a-z]{2}(?:-[a-z]{2})?/)?(?:embed/)?(track|album|artist|playlist)/([A-Za-z0-9]{22})(?:/.*)?$");
    private static final Pattern YOUTUBE_ID = Pattern.compile("^[A-Za-z0-9_-]{11}$");
    private static final Pattern YOUTUBE_PLAYLIST_ID = Pattern.compile("^[A-Za-z0-9_-]{13,}$");
    private static final Pattern YOUTUBE_CHANNEL_ID = Pattern.compile("^UC[A-Za-z0-9_-]{22}$");

    private MusicLinkParser() {}

    public static Optional<MusicLink> parse(String raw) {
        if (raw == null) return Optional.empty();
        String text = raw.trim();
        if (text.isEmpty()) return Optional.empty();

        Matcher uri = SPOTIFY_URI.matcher(text);
        if (uri.matches()) {
            return Optional.of(new MusicLink(Provider.SPOTIFY, kindOf(uri.group(1)), uri.group(2), text));
        }

        String withScheme = text.matches("^[a-zA-Z][a-zA-Z0-9+.-]*://.*") ? text : "https://" + text;
        URI parsed;
        try {
            parsed = new URI(withScheme);
        } catch (URISyntaxException e) {
            return Optional.empty();
        }
        String host = parsed.getHost();
        if (host == null) return Optional.empty();
        host = host.toLowerCase(Locale.ROOT);
        if (host.startsWith("www.")) host = host.substring(4);
        String path = parsed.getPath() == null ? "" : parsed.getPath();
        Map<String, String> query = queryParams(parsed.getRawQuery());

        if (host.equals("open.spotify.com") || host.equals("play.spotify.com")) {
            Matcher m = SPOTIFY_PATH.matcher(path);
            if (m.matches()) {
                return Optional.of(new MusicLink(Provider.SPOTIFY, kindOf(m.group(1)), m.group(2), text));
            }
            return Optional.empty();
        }

        if (host.equals("youtu.be")) {
            String id = firstSegment(path);
            return youtubeVideo(id, text);
        }

        if (host.equals("youtube.com") || host.equals("m.youtube.com") || host.equals("music.youtube.com")
                || host.equals("youtube-nocookie.com")) {
            if (path.equals("/playlist")) {
                String list = query.get("list");
                if (list != null && YOUTUBE_PLAYLIST_ID.matcher(list).matches()) {
                    return Optional.of(new MusicLink(Provider.YOUTUBE, SourceKind.PLAYLIST, list, text));
                }
                return Optional.empty();
            }
            if (path.equals("/watch") || path.equals("/")) {
                return youtubeVideo(query.get("v"), text);
            }
            if (path.startsWith("/shorts/") || path.startsWith("/embed/") || path.startsWith("/live/")
                    || path.startsWith("/v/")) {
                return youtubeVideo(secondSegment(path), text);
            }
            if (path.startsWith("/channel/")) {
                String id = secondSegment(path);
                if (id != null && YOUTUBE_CHANNEL_ID.matcher(id).matches()) {
                    return Optional.of(new MusicLink(Provider.YOUTUBE, SourceKind.CHANNEL, id, text));
                }
                return Optional.empty();
            }
            if (path.startsWith("/@")) {
                String handle = firstSegment(path);
                if (handle != null && handle.length() > 1) {
                    return Optional.of(new MusicLink(Provider.YOUTUBE, SourceKind.CHANNEL, handle, text));
                }
                return Optional.empty();
            }
            if (path.startsWith("/c/") || path.startsWith("/user/")) {
                String name = secondSegment(path);
                if (name != null && !name.isEmpty()) {
                    return Optional.of(new MusicLink(Provider.YOUTUBE, SourceKind.CHANNEL, "@" + name, text));
                }
                return Optional.empty();
            }
            return Optional.empty();
        }

        return Optional.empty();
    }

    private static Optional<MusicLink> youtubeVideo(String id, String url) {
        if (id != null && YOUTUBE_ID.matcher(id).matches()) {
            return Optional.of(new MusicLink(Provider.YOUTUBE, SourceKind.TRACK, id, url));
        }
        return Optional.empty();
    }

    private static SourceKind kindOf(String spotifyType) {
        return SourceKind.valueOf(spotifyType.toUpperCase(Locale.ROOT));
    }

    private static String firstSegment(String path) {
        String[] parts = path.split("/");
        for (String part : parts) {
            if (!part.isEmpty()) return part;
        }
        return null;
    }

    private static String secondSegment(String path) {
        String[] parts = path.split("/");
        int seen = 0;
        for (String part : parts) {
            if (part.isEmpty()) continue;
            seen++;
            if (seen == 2) return part;
        }
        return null;
    }

    private static Map<String, String> queryParams(String rawQuery) {
        Map<String, String> out = new HashMap<>();
        if (rawQuery == null || rawQuery.isEmpty()) return out;
        for (String pair : rawQuery.split("&")) {
            int eq = pair.indexOf('=');
            String key = eq >= 0 ? pair.substring(0, eq) : pair;
            String value = eq >= 0 ? pair.substring(eq + 1) : "";
            out.putIfAbsent(
                URLDecoder.decode(key, StandardCharsets.UTF_8),
                URLDecoder.decode(value, StandardCharsets.UTF_8));
        }
        return out;
    }
}
