package se.dansbart.e2e.admin;

import org.jooq.DSLContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import se.dansbart.domain.analytics.TrackPlayback;
import se.dansbart.domain.analytics.TrackPlaybackJooqRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.e2e.base.AbstractE2ETest;

import java.util.UUID;

import static org.hamcrest.Matchers.equalTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminStatsControllerE2ETest extends AbstractE2ETest {

    private static final UUID ADMIN_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000099");
    private static final UUID REGULAR_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000098");

    @Autowired
    private DSLContext dsl;

    @Autowired
    private TrackPlaybackJooqRepository playbackRepository;

    @Nested
    @DisplayName("Authorization")
    class Authorization {

        @Test
        @DisplayName("anonymous cannot read admin stats")
        void anonymousCannotReadAdminStats() throws Exception {
            mockMvc.perform(get("/api/admin/stats"))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("normal user cannot read admin stats")
        void normalUserCannotReadAdminStats() throws Exception {
            mockMvc.perform(get("/api/admin/stats")
                    .with(jwt.userToken(REGULAR_USER_ID)))
                .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("GET /api/admin/stats")
    class GetAdminStats {

        @Test
        @DisplayName("admin sees private and public counts")
        void adminSeesPrivateAndPublicCounts() throws Exception {
            Track publicTrack1 = testData.track()
                .withTitle("Public Track 1")
                .complete()
                .build();

            Track publicTrack2 = testData.track()
                .withTitle("Public Track 2")
                .complete()
                .build();

            Track privateTrack = testData.track()
                .withTitle("Private Track")
                .complete()
                .build();

            dsl.execute("update tracks set is_private = true where id = ?", privateTrack.getId());

            playbackRepository.insert(TrackPlayback.builder()
                .trackId(publicTrack1.getId()).platform("spotify").durationSeconds(100).build());
            playbackRepository.insert(TrackPlayback.builder()
                .trackId(publicTrack1.getId()).platform("spotify").durationSeconds(100).build());
            playbackRepository.insert(TrackPlayback.builder()
                .trackId(publicTrack2.getId()).platform("spotify").durationSeconds(100).build());

            playbackRepository.insert(TrackPlayback.builder()
                .trackId(privateTrack.getId()).platform("spotify").durationSeconds(100).build());
            playbackRepository.insert(TrackPlayback.builder()
                .trackId(privateTrack.getId()).platform("spotify").durationSeconds(100).build());

            mockMvc.perform(get("/api/admin/stats")
                    .with(jwt.adminToken(ADMIN_USER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.privateTrackCount", equalTo(1)))
                .andExpect(jsonPath("$.publicPlayCount", equalTo(3)))
                .andExpect(jsonPath("$.privatePlayCount", equalTo(2)))
                .andExpect(jsonPath("$.library.totalTracks", equalTo(2)));
        }

        @Test
        @DisplayName("public stats still count public tracks only")
        void publicStatsStillCountPublicTracksOnly() throws Exception {
            testData.track()
                .withTitle("Public Track 1")
                .complete()
                .build();

            testData.track()
                .withTitle("Public Track 2")
                .complete()
                .build();

            mockMvc.perform(get("/api/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTracks", equalTo(2)));
        }
    }
}
