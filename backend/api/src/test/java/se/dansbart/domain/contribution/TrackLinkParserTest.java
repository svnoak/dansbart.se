package se.dansbart.domain.contribution;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import se.dansbart.domain.contribution.TrackLinkParser.ParsedLink;
import se.dansbart.domain.contribution.TrackLinkParser.Source;

import static org.assertj.core.api.Assertions.assertThat;

class TrackLinkParserTest {

    @ParameterizedTest
    @ValueSource(strings = {
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=42",
        "youtube.com/watch?v=dQw4w9WgXcQ",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVM",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ?si=abc",
        "https://www.youtube.com/shorts/dQw4w9WgXcQ",
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "  https://youtu.be/dQw4w9WgXcQ  ",
    })
    void parsesYoutubeLinks(String url) {
        assertThat(TrackLinkParser.parse(url)).contains(new ParsedLink(Source.YOUTUBE, "dQw4w9WgXcQ"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
        "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=1234abcd",
        "https://open.spotify.com/intl-sv/track/4uLU6hMCjMI75M1A2tKUQC",
        "open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
        "spotify:track:4uLU6hMCjMI75M1A2tKUQC",
    })
    void parsesSpotifyTrackLinks(String url) {
        assertThat(TrackLinkParser.parse(url)).contains(new ParsedLink(Source.SPOTIFY, "4uLU6hMCjMI75M1A2tKUQC"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "",
        "   ",
        "not a link",
        "https://www.youtube.com/playlist?list=PL123",
        "https://www.youtube.com/@somechannel",
        "https://www.youtube.com/watch?v=tooShort",
        "https://open.spotify.com/album/4uLU6hMCjMI75M1A2tKUQC",
        "https://open.spotify.com/playlist/4uLU6hMCjMI75M1A2tKUQC",
        "https://open.spotify.com/track/short",
        "https://evil.example.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    })
    void rejectsOtherLinks(String url) {
        assertThat(TrackLinkParser.parse(url)).isEmpty();
    }

    @org.junit.jupiter.api.Test
    void rejectsNull() {
        assertThat(TrackLinkParser.parse(null)).isEmpty();
    }
}
