package se.dansbart.domain.submission;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class YouTubeTitleParserTest {

    @Test
    void splitsArtistAndTitleOnDash() {
        var parsed = YouTubeTitleParser.parse("Väsen - Polska efter Pekkos Per (Official Video)", "Some Channel");
        assertThat(parsed.artist()).isEqualTo("Väsen");
        assertThat(parsed.title()).isEqualTo("Polska efter Pekkos Per");
    }

    @Test
    void usesTheChannelWhenThereIsNoSeparator() {
        var parsed = YouTubeTitleParser.parse("Hambo från Hälsingland", "Pelle Björnlert - Topic");
        assertThat(parsed.artist()).isEqualTo("Pelle Björnlert");
        assertThat(parsed.title()).isEqualTo("Hambo från Hälsingland");
    }

    @Test
    void handlesEnDashAndPipe() {
        assertThat(YouTubeTitleParser.parse("Garmarna – Vänner och fränder", null).artist()).isEqualTo("Garmarna");
        assertThat(YouTubeTitleParser.parse("Garmarna | Vänner och fränder", null).title()).isEqualTo("Vänner och fränder");
    }

    @Test
    void doesNotSplitOnAHyphenInsideAWord() {
        var parsed = YouTubeTitleParser.parse("Bingsjö-polska", "Kanalen");
        assertThat(parsed.artist()).isEqualTo("Kanalen");
        assertThat(parsed.title()).isEqualTo("Bingsjö-polska");
    }
}
