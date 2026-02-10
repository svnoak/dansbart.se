package se.dansbart.e2e.admin;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.track.Track;
import se.dansbart.e2e.base.AbstractE2ETest;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * E2E tests for AdminArtistController admin endpoints.
 */
class AdminArtistControllerE2ETest extends AbstractE2ETest {

    private static final String ADMIN_USER_ID = "admin-user-123";
    private static final String REGULAR_USER_ID = "regular-user-456";

    @Nested
    @DisplayName("Authorization")
    class Authorization {

        @Test
        @DisplayName("admin endpoints should reject unauthenticated requests")
        void adminEndpoint_withoutAuth_shouldReturn401() throws Exception {
            mockMvc.perform(get("/api/admin/artists"))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("admin endpoints should reject non-admin users")
        void adminEndpoint_withUserRole_shouldReturn403() throws Exception {
            mockMvc.perform(get("/api/admin/artists")
                    .with(jwt.userToken(REGULAR_USER_ID)))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("admin endpoints should allow admin users")
        void adminEndpoint_withAdminRole_shouldSucceed() throws Exception {
            mockMvc.perform(get("/api/admin/artists")
                    .with(jwt.adminToken(ADMIN_USER_ID)))
                .andExpect(status().isOk());
        }
    }

    @Nested
    @DisplayName("GET /api/admin/artists")
    class GetArtists {

        @Test
        @DisplayName("should return paginated artists")
        void getArtists_shouldReturnPaginatedList() throws Exception {
            testData.artist().withName("Artist 1").build();
            testData.artist().withName("Artist 2").build();
            testData.artist().withName("Artist 3").build();

            mockMvc.perform(get("/api/admin/artists")
                    .with(jwt.adminToken(ADMIN_USER_ID))
                    .param("limit", "10")
                    .param("offset", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.total").value(3));
        }

        @Test
        @DisplayName("should filter by search term")
        void getArtists_withSearch_shouldFilter() throws Exception {
            testData.artist().withName("Folk Band Alpha").build();
            testData.artist().withName("Jazz Trio").build();
            testData.artist().withName("Folk Duo Beta").build();

            mockMvc.perform(get("/api/admin/artists")
                    .with(jwt.adminToken(ADMIN_USER_ID))
                    .param("search", "Folk"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)));
        }

        @Test
        @DisplayName("should include pendingCount for artists with pending tracks")
        void getArtists_shouldIncludePendingCount() throws Exception {
            Artist artist = testData.artist().withName("Artist With Pending").build();
            testData.track().withTitle("Done Track").withArtist(artist).complete().build();
            testData.track().withTitle("Pending Track").withArtist(artist).pending().build();

            mockMvc.perform(get("/api/admin/artists")
                    .with(jwt.adminToken(ADMIN_USER_ID))
                    .param("search", "Artist With Pending")
                    .param("limit", "10")
                    .param("offset", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].id").value(artist.getId().toString()))
                .andExpect(jsonPath("$.items[0].pendingCount").value(1));
        }
    }

    @Nested
    @DisplayName("GET /api/admin/artists/{id}/isolation-check")
    class IsolationCheck {

        @Test
        @DisplayName("should return isolation info for isolated artist")
        void isolationCheck_forIsolatedArtist_shouldReturnIsolated() throws Exception {
            Artist artist = testData.artist().withName("Solo Artist").build();
            testData.track().withTitle("Solo Track").withArtist(artist).complete().build();

            mockMvc.perform(get("/api/admin/artists/{id}/isolation-check", artist.getId())
                    .with(jwt.adminToken(ADMIN_USER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isIsolated").value(true));
        }

        @Test
        @DisplayName("should return 404 for non-existent artist")
        void isolationCheck_forNonExistent_shouldReturn404() throws Exception {
            mockMvc.perform(get("/api/admin/artists/{id}/isolation-check",
                        "00000000-0000-0000-0000-000000000000")
                    .with(jwt.adminToken(ADMIN_USER_ID)))
                .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("POST /api/admin/artists/{id}/approve")
    class ApproveArtist {

        @Test
        @DisplayName("should approve artist and queue pending tracks")
        void approveArtist_shouldApproveAndQueueTracks() throws Exception {
            Artist artist = testData.artist().withName("Pending Artist").build();
            testData.track().withTitle("Pending Track 1").withArtist(artist).pending().build();
            testData.track().withTitle("Pending Track 2").withArtist(artist).pending().build();

            mockMvc.perform(post("/api/admin/artists/{id}/approve", artist.getId())
                    .with(jwt.adminToken(ADMIN_USER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.artistId").value(artist.getId().toString()));
        }

        @Test
        @DisplayName("should return 404 for non-existent artist")
        void approveArtist_forNonExistent_shouldReturn404() throws Exception {
            mockMvc.perform(post("/api/admin/artists/{id}/approve",
                        "00000000-0000-0000-0000-000000000000")
                    .with(jwt.adminToken(ADMIN_USER_ID)))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("should reject request from non-admin user")
        void approveArtist_byNonAdmin_shouldReturn403() throws Exception {
            Artist artist = testData.artist().withName("Pending Artist").build();

            mockMvc.perform(post("/api/admin/artists/{id}/approve", artist.getId())
                    .with(jwt.userToken(REGULAR_USER_ID)))
                .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("POST /api/admin/artists/{id}/reject")
    class RejectArtist {

        @Test
        @DisplayName("should reject artist with reason")
        void rejectArtist_shouldRejectWithReason() throws Exception {
            Artist artist = testData.artist().withName("Bad Artist").build();
            testData.track().withTitle("Bad Track").withArtist(artist).pending().build();

            mockMvc.perform(post("/api/admin/artists/{id}/reject", artist.getId())
                    .with(jwt.adminToken(ADMIN_USER_ID))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of(
                        "reason", "Not folk music",
                        "dryRun", false,
                        "deleteContent", true
                    ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"));
        }

        @Test
        @DisplayName("should support dry run mode")
        void rejectArtist_withDryRun_shouldNotDelete() throws Exception {
            Artist artist = testData.artist().withName("Test Artist").build();
            Track track = testData.track().withTitle("Test Track").withArtist(artist).pending().build();

            mockMvc.perform(post("/api/admin/artists/{id}/reject", artist.getId())
                    .with(jwt.adminToken(ADMIN_USER_ID))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of(
                        "reason", "Testing dry run",
                        "dryRun", true,
                        "deleteContent", true
                    ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dryRun").value(true));
        }
    }

    @Nested
    @DisplayName("POST /api/admin/artists/bulk-approve")
    class BulkApprove {

        @Test
        @DisplayName("should approve multiple artists")
        void bulkApprove_shouldApproveMultiple() throws Exception {
            Artist artist1 = testData.artist().withName("Artist 1").build();
            Artist artist2 = testData.artist().withName("Artist 2").build();
            testData.track().withTitle("Track 1").withArtist(artist1).pending().build();
            testData.track().withTitle("Track 2").withArtist(artist2).pending().build();

            mockMvc.perform(post("/api/admin/artists/bulk-approve")
                    .with(jwt.adminToken(ADMIN_USER_ID))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("ids", List.of(
                        artist1.getId().toString(),
                        artist2.getId().toString()
                    )))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approved").value(2));
        }

        @Test
        @DisplayName("should handle empty list")
        void bulkApprove_withEmptyList_shouldSucceed() throws Exception {
            mockMvc.perform(post("/api/admin/artists/bulk-approve")
                    .with(jwt.adminToken(ADMIN_USER_ID))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("ids", List.of()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approved").value(0));
        }
    }

    @Nested
    @DisplayName("POST /api/admin/artists/bulk-reject")
    class BulkReject {

        @Test
        @DisplayName("should reject multiple artists")
        void bulkReject_shouldRejectMultiple() throws Exception {
            Artist artist1 = testData.artist().withName("Bad Artist 1").build();
            Artist artist2 = testData.artist().withName("Bad Artist 2").build();

            mockMvc.perform(post("/api/admin/artists/bulk-reject")
                    .with(jwt.adminToken(ADMIN_USER_ID))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of(
                        "ids", List.of(artist1.getId().toString(), artist2.getId().toString()),
                        "reason", "Bulk rejection test",
                        "deleteContent", true
                    ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rejected").value(2));
        }
    }

    @Nested
    @DisplayName("GET /api/admin/artists/{id}/collaboration-network")
    class CollaborationNetwork {

        @Test
        @DisplayName("should return collaboration network")
        void getCollaborationNetwork_shouldReturnNetwork() throws Exception {
            Artist artist = testData.artist().withName("Main Artist").build();
            testData.track().withTitle("Solo Track").withArtist(artist).complete().build();

            mockMvc.perform(get("/api/admin/artists/{id}/collaboration-network", artist.getId())
                    .with(jwt.adminToken(ADMIN_USER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.artistId").value(artist.getId().toString()));
        }

        @Test
        @DisplayName("should return 404 for non-existent artist")
        void getCollaborationNetwork_forNonExistent_shouldReturn404() throws Exception {
            mockMvc.perform(get("/api/admin/artists/{id}/collaboration-network",
                        "00000000-0000-0000-0000-000000000000")
                    .with(jwt.adminToken(ADMIN_USER_ID)))
                .andExpect(status().isNotFound());
        }
    }
}
