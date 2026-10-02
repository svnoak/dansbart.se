package se.dansbart.e2e.public_;

import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import se.dansbart.domain.album.Album;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.track.Track;
import se.dansbart.e2e.base.AbstractE2ETest;

import java.sql.Timestamp;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.table;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ArtistControllerE2ETest extends AbstractE2ETest {

    @Autowired
    private DSLContext dsl;

    private Artist artistA;
    private Artist artistB;
    private Album albumX;
    private Album albumY;
    private Album albumZ;
    private Album albumW;

    @BeforeEach
    void setUp() {
        artistA = testData.artist().withName("Artist A").build();
        artistB = testData.artist().withName("Artist B").build();

        // Album X: B as primary artist, has track by A and track by B
        albumX = testData.album()
            .withTitle("Album X")
            .withReleaseDate("2025-01-15")
            .withArtist(artistB)
            .build();
        testData.addTrackToAlbum(albumX, testData.track().withTitle("Track A on X").withArtist(artistA).build());
        testData.addTrackToAlbum(albumX, testData.track().withTitle("Track B on X").withArtist(artistB).build());

        // Album Y: A as primary artist, has 2 tracks by A
        albumY = testData.album()
            .withTitle("Album Y")
            .withReleaseDate("2025-02-10")
            .withArtist(artistA)
            .build();
        testData.addTrackToAlbum(albumY, testData.track().withTitle("Track 1 on Y").withArtist(artistA).build());
        testData.addTrackToAlbum(albumY, testData.track().withTitle("Track 2 on Y").withArtist(artistA).build());

        // Album Z: A as primary artist, has no tracks, release date is null
        albumZ = testData.album()
            .withTitle("Album Z")
            .withReleaseDate(null)
            .withArtist(artistA)
            .build();

        // Album W: B as primary artist, has track by B only
        albumW = testData.album()
            .withTitle("Album W")
            .withReleaseDate("2025-03-05")
            .withArtist(artistB)
            .build();
        testData.addTrackToAlbum(albumW, testData.track().withTitle("Track B on W").withArtist(artistB).build());
    }

    @Nested
    @DisplayName("POST /api/artists/{id}/flag")
    class FlagArtist {

        @Test
        @DisplayName("should flag anonymously and store default reason")
        void flagArtist_shouldFlagAnonymously() throws Exception {
            mockMvc.perform(post("/api/artists/{id}/flag", artistA.getId()))
                .andExpect(status().isNoContent());

            var row = dsl.select(
                    field("is_flagged", Boolean.class),
                    field("flagged_at", Timestamp.class),
                    field("flag_reason", String.class))
                .from(table("artists"))
                .where(field("id").eq(artistA.getId()))
                .fetchOne();

            assertThat(row).isNotNull();
            assertThat(row.get(field("is_flagged", Boolean.class))).isTrue();
            assertThat(row.get(field("flagged_at", Timestamp.class))).isNotNull();
            assertThat(row.get(field("flag_reason", String.class))).isEqualTo("not_folk_music");
        }

        @Test
        @DisplayName("should store custom reason when provided")
        void flagArtist_withReason_shouldStoreReason() throws Exception {
            mockMvc.perform(post("/api/artists/{id}/flag", artistA.getId())
                    .param("reason", "other"))
                .andExpect(status().isNoContent());

            var row = dsl.select(field("flag_reason", String.class))
                .from(table("artists"))
                .where(field("id").eq(artistA.getId()))
                .fetchOne();

            assertThat(row).isNotNull();
            assertThat(row.get(field("flag_reason", String.class))).isEqualTo("other");
        }

        @Test
        @DisplayName("should keep first reason on second flag")
        void flagArtist_secondFlag_shouldKeepFirstReason() throws Exception {
            mockMvc.perform(post("/api/artists/{id}/flag", artistA.getId())
                    .param("reason", "first"))
                .andExpect(status().isNoContent());

            mockMvc.perform(post("/api/artists/{id}/flag", artistA.getId())
                    .param("reason", "second"))
                .andExpect(status().isNoContent());

            var row = dsl.select(field("flag_reason", String.class))
                .from(table("artists"))
                .where(field("id").eq(artistA.getId()))
                .fetchOne();

            assertThat(row).isNotNull();
            assertThat(row.get(field("flag_reason", String.class))).isEqualTo("first");
        }

        @Test
        @DisplayName("should truncate long reason to 100 characters")
        void flagArtist_withLongReason_shouldStoreAtMost100Characters() throws Exception {
            String longReason = "x".repeat(150);

            mockMvc.perform(post("/api/artists/{id}/flag", artistA.getId())
                    .param("reason", longReason))
                .andExpect(status().isNoContent());

            var row = dsl.select(field("flag_reason", String.class))
                .from(table("artists"))
                .where(field("id").eq(artistA.getId()))
                .fetchOne();

            assertThat(row).isNotNull();
            assertThat(row.get(field("flag_reason", String.class)).length()).isEqualTo(100);
        }

        @Test
        @DisplayName("should return 404 for unknown artist")
        void flagArtist_withUnknownId_shouldReturn404() throws Exception {
            mockMvc.perform(post("/api/artists/{id}/flag", UUID.randomUUID()))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("should not hide flagged artist tracks")
        void flagArtist_shouldKeepTracksVisible() throws Exception {
            var track = testData.track()
                .withTitle("Test Track")
                .withArtist(artistA)
                .withDanceStyle("Polska")
                .complete()
                .build();

            mockMvc.perform(post("/api/artists/{id}/flag", artistA.getId()))
                .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/tracks/{id}", track.getId()))
                .andExpect(status().isOk());
        }
    }

    @Nested
    @DisplayName("GET /api/artists/{id}/albums")
    class GetArtistAlbums {

        @Test
        @DisplayName("includes album where artist only has tracks on it")
        void getArtistAlbums_includesAlbumWhereArtistOnlyHasTracks() throws Exception {
            mockMvc.perform(get("/api/artists/{id}/albums", artistA.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[*].id", hasItems(
                    albumX.getId().toString(),
                    albumY.getId().toString(),
                    albumZ.getId().toString()
                )))
                .andExpect(jsonPath("$[*].id", not(hasItem(albumW.getId().toString()))));
        }

        @Test
        @DisplayName("returns each album once")
        void getArtistAlbums_returnsEachAlbumOnce() throws Exception {
            mockMvc.perform(get("/api/artists/{id}/albums", artistA.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.id == '" + albumY.getId() + "')]", hasSize(1)));
        }

        @Test
        @DisplayName("orders by release date descending with nulls last")
        void getArtistAlbums_ordersByReleaseDateDescNullsLast() throws Exception {
            mockMvc.perform(get("/api/artists/{id}/albums", artistA.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].title").value("Album Y"))
                .andExpect(jsonPath("$[1].title").value("Album X"))
                .andExpect(jsonPath("$[2].title").value("Album Z"));
        }

        @Test
        @DisplayName("track count counts all album tracks")
        void getArtistAlbums_trackCountCountsAllAlbumTracks() throws Exception {
            mockMvc.perform(get("/api/artists/{id}/albums", artistA.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[?(@.id == '" + albumX.getId() + "')].trackCount", hasItem(2)));
        }
    }

    @Nested
    @DisplayName("GET /api/artists/{id}")
    class GetArtistById {

        @Test
        @DisplayName("album count includes albums where artist only has tracks")
        void getArtistById_albumCountIncludesAlbumsWhereArtistOnlyHasTracks() throws Exception {
            mockMvc.perform(get("/api/artists/{id}", artistA.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.albumCount").value(3))
                .andExpect(jsonPath("$.albums").isArray())
                .andExpect(jsonPath("$.albums", hasSize(3)));
        }

        @Test
        @DisplayName("should not expose flag fields in JSON response")
        void getArtist_shouldNotExposesFlagFields() throws Exception {
            mockMvc.perform(post("/api/artists/{id}/flag", artistA.getId()))
                .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/artists/{id}", artistA.getId()))
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
