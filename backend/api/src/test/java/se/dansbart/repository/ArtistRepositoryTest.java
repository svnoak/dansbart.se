package se.dansbart.repository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import se.dansbart.e2e.fixture.TestDataFactory;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.artist.ArtistRepository;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for JPA ArtistRepository.
 */
class ArtistRepositoryTest extends AbstractRepositoryTest {

    @Autowired
    private ArtistRepository artistRepository;

    @Autowired
    private TestDataFactory testData;

    @Nested
    @DisplayName("findBySpotifyId")
    class FindBySpotifyId {

        @Test
        @DisplayName("returns artist when spotify id matches")
        void returnsArtistWhenSpotifyIdMatches() {
            Artist saved = testData.artist().withName("Folk Band").withSpotifyId("spotify-123").build();

            var found = artistRepository.findBySpotifyId("spotify-123");

            assertThat(found).isPresent();
            assertThat(found.get().getId()).isEqualTo(saved.getId());
            assertThat(found.get().getName()).isEqualTo("Folk Band");
            assertThat(found.get().getSpotifyId()).isEqualTo("spotify-123");
        }

        @Test
        @DisplayName("returns empty when spotify id not found")
        void returnsEmptyWhenNotFound() {
            var found = artistRepository.findBySpotifyId("nonexistent");
            assertThat(found).isEmpty();
        }
    }

    @Nested
    @DisplayName("searchByName")
    class SearchByName {

        @Test
        @DisplayName("returns matching artists case-insensitively")
        void returnsMatchingArtistsCaseInsensitively() {
            testData.artist().withName("Polska Masters").build();
            testData.artist().withName("Hambo Band").build();
            testData.artist().withName("Another Polska").build();

            var page = artistRepository.searchByName("polska", PageRequest.of(0, 10));

            assertThat(page.getContent()).hasSize(2);
            assertThat(page.getContent()).extracting(Artist::getName)
                .containsExactlyInAnyOrder("Polska Masters", "Another Polska");
        }

        @Test
        @DisplayName("returns empty page when no match")
        void returnsEmptyWhenNoMatch() {
            testData.artist().withName("Folk Band").build();
            var page = artistRepository.searchByName("xyznone", PageRequest.of(0, 10));
            assertThat(page.getContent()).isEmpty();
        }
    }

    @Nested
    @DisplayName("findVerifiedArtists")
    class FindVerifiedArtists {

        @Test
        @DisplayName("returns only verified artists")
        void returnsOnlyVerifiedArtists() {
            testData.artist().withName("Verified One").verified().build();
            testData.artist().withName("Unverified").build();
            testData.artist().withName("Verified Two").verified().build();

            var page = artistRepository.findVerifiedArtists(PageRequest.of(0, 10));

            assertThat(page.getContent()).hasSize(2);
            assertThat(page.getContent()).allMatch(Artist::getIsVerified);
        }
    }
}
