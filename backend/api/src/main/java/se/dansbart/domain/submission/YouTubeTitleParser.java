package se.dansbart.domain.submission;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Splits a YouTube video title into artist and track title. Uploaders mostly write
 * "Artist - Title"; when they don't, the channel name is the artist. "Artist - Topic"
 * channels (YouTube's auto-generated artist channels) lose their suffix.
 */
public final class YouTubeTitleParser {

    public record ParsedTitle(String artist, String title) {}

    private static final Pattern SEPARATOR = Pattern.compile("\\s+[-–—|]\\s+");
    private static final List<Pattern> NOISE = List.of(
        Pattern.compile("(?i)\\s*[\\[(]\\s*(official\\s+)?(music\\s+)?(video|audio|lyric\\s+video|visualizer|hd|hq|4k)\\s*[\\])]"),
        Pattern.compile("(?i)\\s*[\\[(]\\s*official\\s*[\\])]"),
        Pattern.compile("(?i)\\s*[\\[(]\\s*(full\\s+)?album\\s*[\\])]")
    );

    private YouTubeTitleParser() {}

    public static ParsedTitle parse(String rawTitle, String channelTitle) {
        String cleaned = stripNoise(rawTitle == null ? "" : rawTitle).trim();
        String channel = cleanChannel(channelTitle);
        String[] parts = SEPARATOR.split(cleaned, 2);
        if (parts.length == 2 && !parts[0].isBlank() && !parts[1].isBlank()) {
            return new ParsedTitle(parts[0].trim(), parts[1].trim());
        }
        return new ParsedTitle(channel, cleaned.isBlank() ? rawTitle : cleaned);
    }

    private static String stripNoise(String title) {
        String out = title;
        for (Pattern p : NOISE) out = p.matcher(out).replaceAll("");
        return out;
    }

    private static String cleanChannel(String channel) {
        if (channel == null) return null;
        String out = channel.trim();
        if (out.toLowerCase().endsWith(" - topic")) out = out.substring(0, out.length() - " - topic".length()).trim();
        return out.isBlank() ? null : out;
    }
}
