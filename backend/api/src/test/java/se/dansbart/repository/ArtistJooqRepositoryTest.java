package se.dansbart.repository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;

import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.artist.ArtistJooqRepository;
import se.dansbart.e2e.fixture.TestDataFactory;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for jOOQ-based ArtistJooqRepository (type-safe SQL).
 */
class ArtistJooqRepositoryTest extends AbstractRepositoryTest {

    @Autowired
    private ArtistJooqRepository artistJooqRepository;

    @Autowired
    private TestDataFactory testData;

    @Nested
    @DisplayName("findBySpotifyId")
    class FindBySpotifyId {

        @Test
        @DisplayName("returns artist when spotify id matches")
        void returnsArtistWhenSpotifyIdMatches() {
            Artist saved = testData.artist().withName("jOOQ Test Artist").withSpotifyId("jooq-spotify-456").build();
            flush();

            var found = artistJooqRepository.findBySpotifyId("jooq-spotify-456");

            assertThat(found).isPresent();
            assertThat(found.get().getId()).isEqualTo(saved.getId());
            assertThat(found.get().getName()).isEqualTo("jOOQ Test Artist");
            assertThat(found.get().getSpotifyId()).isEqualTo("jooq-spotify-456");
        }

        @Test
        @DisplayName("returns empty when spotify id not found")
        void returnsEmptyWhenNotFound() {
            var found = artistJooqRepository.findBySpotifyId("nonexistent-jooq");
            assertThat(found).isEmpty();
        }
    }

    @Nested
    @DisplayName("findById")
    class FindById {

        @Test
        @DisplayName("returns artist when id matches")
        void returnsArtistWhenIdMatches() {
            Artist saved = testData.artist().withName("ById Artist").build();
            flush();

            var found = artistJooqRepository.findById(saved.getId());

            assertThat(found).isPresent();
            assertThat(found.get().getId()).isEqualTo(saved.getId());
            assertThat(found.get().getName()).isEqualTo("ById Artist");
        }
    }

    @Nested
    @DisplayName("searchByName")
    class SearchByName {

        @Test
        @DisplayName("returns matching artists case-insensitively")
        void returnsMatchingArtistsCaseInsensitively() {
            testData.artist().withName("Hambo Heroes").build();
            testData.artist().withName("Schottis Group").build();
            testData.artist().withName("Another Hambo").build();
            flush();

            var page = artistJooqRepository.searchByName("hambo", PageRequest.of(0, 10));

            assertThat(page.getContent()).hasSize(2);
            assertThat(page.getContent()).extracting(Artist::getName)
                .containsExactlyInAnyOrder("Hambo Heroes", "Another Hambo");
        }

        @Test
        @DisplayName("respects pagination")
        void respectsPagination() {
            testData.artist().withName("Page A").build();
            testData.artist().withName("Page B").build();
            testData.artist().withName("Page C").build();
            flush();

            var page = artistJooqRepository.searchByName("page", PageRequest.of(0, 2));

            assertThat(page.getContent()).hasSize(2);
            assertThat(page.getTotalElements()).isEqualTo(3);
            assertThat(page.getTotalPages()).isEqualTo(2);
        }
    }

    @Nested
    @DisplayName("findVerifiedArtists")
    class FindVerifiedArtists {

        @Test
        @DisplayName("returns only verified artists")
        void returnsOnlyVerifiedArtists() {
            testData.artist().withName("Verified jOOQ").verified().build();
            testData.artist().withName("Not Verified").build();
            flush();

            var page = artistJooqRepository.findVerifiedArtists(PageRequest.of(0, 10));

            assertThat(page.getContent()).hasSize(1);
            assertThat(page.getContent().get(0).getName()).isEqualTo("Verified jOOQ");
            assertThat(page.getContent().get(0).getIsVerified()).isTrue();
        }
    }
}
