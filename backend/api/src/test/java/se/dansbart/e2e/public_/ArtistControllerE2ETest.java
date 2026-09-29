package se.dansbart.e2e.public_;

import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.track.Track;
import se.dansbart.e2e.base.AbstractE2ETest;

import java.sql.Timestamp;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.hasKey;
import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.table;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static se.dansbart.jooq.Tables.ARTISTS;

/**
 * E2E tests for ArtistController public endpoints.
 */
class ArtistControllerE2ETest extends AbstractE2ETest {

    @Autowired
    private DSLContext dsl;

    private Artist artist;

    @BeforeEach
    void setUp() {
        artist = testData.artist().withName("Test Artist").build();
    }

    @Nested
    @DisplayName("POST /api/artists/{id}/flag")
    class FlagArtist {

        @Test
        @DisplayName("should flag anonymously and store default reason")
        void flagArtist_shouldFlagAnonymously() throws Exception {
            mockMvc.perform(post("/api/artists/{id}/flag", artist.getId()))
                .andExpect(status().isNoContent());

            var row = dsl.select(
                    field("is_flagged", Boolean.class),
                    field("flagged_at", Timestamp.class),
                    field("flag_reason", String.class))
                .from(table("artists"))
                .where(field("id").eq(artist.getId()))
                .fetchOne();

            assertThat(row).isNotNull();
            assertThat(row.get(field("is_flagged", Boolean.class))).isTrue();
            assertThat(row.get(field("flagged_at", Timestamp.class))).isNotNull();
            assertThat(row.get(field("flag_reason", String.class))).isEqualTo("not_folk_music");
        }

        @Test
        @DisplayName("should store custom reason when provided")
        void flagArtist_withReason_shouldStoreReason() throws Exception {
            mockMvc.perform(post("/api/artists/{id}/flag", artist.getId())
                    .param("reason", "other"))
                .andExpect(status().isNoContent());

            var row = dsl.select(field("flag_reason", String.class))
                .from(table("artists"))
                .where(field("id").eq(artist.getId()))
                .fetchOne();

            assertThat(row).isNotNull();
            assertThat(row.get(field("flag_reason", String.class))).isEqualTo("other");
        }

        @Test
        @DisplayName("should keep first reason on second flag")
        void flagArtist_secondFlag_shouldKeepFirstReason() throws Exception {
            mockMvc.perform(post("/api/artists/{id}/flag", artist.getId())
                    .param("reason", "first"))
                .andExpect(status().isNoContent());

            mockMvc.perform(post("/api/artists/{id}/flag", artist.getId())
                    .param("reason", "second"))
                .andExpect(status().isNoContent());

            var row = dsl.select(field("flag_reason", String.class))
                .from(table("artists"))
                .where(field("id").eq(artist.getId()))
                .fetchOne();

            assertThat(row).isNotNull();
            assertThat(row.get(field("flag_reason", String.class))).isEqualTo("first");
        }

        @Test
        @DisplayName("should truncate long reason to 100 characters")
        void flagArtist_withLongReason_shouldStoreAtMost100Characters() throws Exception {
            String longReason = "x".repeat(150);

            mockMvc.perform(post("/api/artists/{id}/flag", artist.getId())
                    .param("reason", longReason))
                .andExpect(status().isNoContent());

            var row = dsl.select(field("flag_reason", String.class))
                .from(table("artists"))
                .where(field("id").eq(artist.getId()))
                .fetchOne();

            assertThat(row).isNotNull();
            assertThat(row.get(field("flag_reason", String.class)).length()).isEqualTo(100);
        }

        @Test
        @DisplayName("should return 404 for unknown artist")
        void flagArtist_withUnknownId_shouldReturn404() throws Exception {
            UUID unknownId = UUID.randomUUID();

            mockMvc.perform(post("/api/artists/{id}/flag", unknownId))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("should not hide flagged artist tracks")
        void flagArtist_shouldKeepTracksVisible() throws Exception {
            Track track = testData.track()
                .withTitle("Test Track")
                .withArtist(artist)
                .withDanceStyle("Polska")
                .complete()
                .build();

            mockMvc.perform(post("/api/artists/{id}/flag", artist.getId()))
                .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/tracks/{id}", track.getId()))
                .andExpect(status().isOk());
        }
    }

    @Nested
    @DisplayName("GET /api/artists/{id}")
    class GetArtistById {

        @Test
        @DisplayName("should not expose flag fields in JSON response")
        void getArtist_shouldNotExposesFlagFields() throws Exception {
            mockMvc.perform(post("/api/artists/{id}/flag", artist.getId()))
                .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/artists/{id}", artist.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(hasKey("isFlagged"))))
                .andExpect(jsonPath("$", not(hasKey("flaggedAt"))))
                .andExpect(jsonPath("$", not(hasKey("flagReason"))))
                .andExpect(jsonPath("$", not(hasKey("is_flagged"))))
                .andExpect(jsonPath("$", not(hasKey("flagged_at"))))
                .andExpect(jsonPath("$", not(hasKey("flag_reason"))));
        }
    }
}
