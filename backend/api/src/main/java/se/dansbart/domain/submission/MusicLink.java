package se.dansbart.domain.submission;

/**
 * A link somebody pasted on the "Lägg till musik" page, reduced to what it points at.
 *
 * @param provider spotify or youtube
 * @param kind     what the link points at; a YouTube video is a {@code track}
 * @param id       the provider's id for that thing (Spotify id, video id, playlist id,
 *                 channel id or handle)
 * @param url      the link as pasted, kept for the review page
 */
public record MusicLink(Provider provider, SourceKind kind, String id, String url) {

    public enum Provider {
        SPOTIFY, YOUTUBE;

        public String dbValue() {
            return name().toLowerCase();
        }
    }

    public enum SourceKind {
        TRACK, ALBUM, ARTIST, PLAYLIST, CHANNEL;

        public String dbValue() {
            return name().toLowerCase();
        }
    }
}
