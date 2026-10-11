package se.dansbart.domain.submission;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import se.dansbart.domain.submission.MusicLink.Provider;
import se.dansbart.domain.submission.MusicLink.SourceKind;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class MusicLinkParserTest {

    @ParameterizedTest
    @CsvSource({
        "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC, TRACK, 4uLU6hMCjMI75M1A2tKUQC",
        "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc123, TRACK, 4uLU6hMCjMI75M1A2tKUQC",
        "https://open.spotify.com/intl-sv/album/1DFixLWuPkv3KT3TnV35m3, ALBUM, 1DFixLWuPkv3KT3TnV35m3",
        "open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF, ARTIST, 0OdUWJ0sBjDrqHygGUXeCF",
        "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M, PLAYLIST, 37i9dQZF1DXcBWIGoYBM5M",
        "spotify:album:1DFixLWuPkv3KT3TnV35m3, ALBUM, 1DFixLWuPkv3KT3TnV35m3",
    })
    void parsesSpotifyLinks(String url, SourceKind kind, String id) {
        Optional<MusicLink> link = MusicLinkParser.parse(url);
        assertThat(link).isPresent();
        assertThat(link.get().provider()).isEqualTo(Provider.SPOTIFY);
        assertThat(link.get().kind()).isEqualTo(kind);
        assertThat(link.get().id()).isEqualTo(id);
    }

    @ParameterizedTest
    @CsvSource({
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ, TRACK, dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ?t=10, TRACK, dQw4w9WgXcQ",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123456789012, TRACK, dQw4w9WgXcQ",
        "https://music.youtube.com/watch?v=dQw4w9WgXcQ, TRACK, dQw4w9WgXcQ",
        "https://www.youtube.com/shorts/dQw4w9WgXcQ, TRACK, dQw4w9WgXcQ",
        "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf, PLAYLIST, PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
        "https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw, CHANNEL, UCuAXFkgsw1L7xaCfnd5JJOw",
        "https://www.youtube.com/@folkmusikgruppen, CHANNEL, @folkmusikgruppen",
        "https://www.youtube.com/@folkmusikgruppen/videos, CHANNEL, @folkmusikgruppen",
        "https://www.youtube.com/c/Folkmusik, CHANNEL, @Folkmusik",
        "https://www.youtube.com/user/folkmusik, CHANNEL, @folkmusik",
    })
    void parsesYouTubeLinks(String url, SourceKind kind, String id) {
        Optional<MusicLink> link = MusicLinkParser.parse(url);
        assertThat(link).isPresent();
        assertThat(link.get().provider()).isEqualTo(Provider.YOUTUBE);
        assertThat(link.get().kind()).isEqualTo(kind);
        assertThat(link.get().id()).isEqualTo(id);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "",
        "   ",
        "not a link",
        "https://example.com/track/4uLU6hMCjMI75M1A2tKUQC",
        "https://open.spotify.com/show/4uLU6hMCjMI75M1A2tKUQC",
        "https://open.spotify.com/track/tooShort",
        "https://www.youtube.com/watch?v=short",
        "https://www.youtube.com/feed/subscriptions",
        "https://www.youtube.com/channel/notachannelid",
    })
    void rejectsOtherLinks(String url) {
        assertThat(MusicLinkParser.parse(url)).isEmpty();
    }

    @Test
    void keepsThePastedUrl() {
        String url = "  https://youtu.be/dQw4w9WgXcQ  ";
        assertThat(MusicLinkParser.parse(url)).get().extracting(MusicLink::url).isEqualTo(url.trim());
    }
}
