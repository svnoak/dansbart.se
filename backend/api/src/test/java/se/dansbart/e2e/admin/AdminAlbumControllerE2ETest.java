package se.dansbart.e2e.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import se.dansbart.domain.album.Album;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.track.Track;
import se.dansbart.e2e.base.AbstractE2ETest;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * E2E tests for AdminAlbumController admin endpoints.
 */
class AdminAlbumControllerE2ETest extends AbstractE2ETest {

    private static final String ADMIN_USER_ID = "admin-user-123";

    @Nested
    @DisplayName("Authorization")
    class Authorization {

        @Test
        @DisplayName("admin album endpoints should reject unauthenticated requests")
        void adminAlbums_withoutAuth_shouldReturn401() throws Exception {
            mockMvc.perform(get("/api/admin/albums"))
                .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("GET /api/admin/albums")
    class GetAlbums {

        @Test
        @DisplayName("should include pendingCount for albums with pending tracks")
        void getAlbums_shouldIncludePendingCount() throws Exception {
            Artist artist = testData.artist().withName("Album Artist").build();
            Album album = testData.album().withTitle("Unique Album Pending").withArtist(artist).build();
            Track doneTrack = testData.track().withTitle("Done").withArtist(artist).complete().build();
            Track pendingTrack = testData.track().withTitle("Pending").withArtist(artist).pending().build();
            testData.addTrackToAlbum(album, doneTrack);
            testData.addTrackToAlbum(album, pendingTrack);

            mockMvc.perform(get("/api/admin/albums")
                    .with(jwt.adminToken(ADMIN_USER_ID))
                    .param("search", "Unique Album Pending")
                    .param("limit", "50")
                    .param("offset", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].id").value(album.getId().toString()))
                .andExpect(jsonPath("$.items[0].pendingCount").value(1));
        }
    }
}
