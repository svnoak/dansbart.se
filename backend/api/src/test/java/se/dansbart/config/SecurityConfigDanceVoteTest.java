package se.dansbart.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import se.dansbart.domain.dance.DanceController;
import se.dansbart.domain.dance.DancePrimaryTrackService;
import se.dansbart.domain.dance.DanceService;
import se.dansbart.voter.VoterContext;

import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exercises the production SecurityConfig filter chain: an anonymous vote must pass,
 * while the sibling primary-track and suggest-track paths still require authentication.
 */
@WebMvcTest(DanceController.class)
@Import(SecurityConfig.class)
@ActiveProfiles("securityfilterchaintest")
class SecurityConfigDanceVoteTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DanceService danceService;

    @MockBean
    private DancePrimaryTrackService dancePrimaryTrackService;

    @MockBean
    private VoterContext voterContext;

    private final UUID danceId = UUID.randomUUID();
    private final UUID trackId = UUID.randomUUID();

    @Test
    void anonymousUpvote_passesTheFilterChain() throws Exception {
        mockMvc.perform(post("/api/dances/{danceId}/tracks/{trackId}/vote", danceId, trackId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"vote\":\"up\"}"))
            .andExpect(status().isOk());
    }

    @Test
    void anonymousVoteRemoval_passesTheFilterChain() throws Exception {
        mockMvc.perform(delete("/api/dances/{danceId}/tracks/{trackId}/vote", danceId, trackId)
                .with(csrf()))
            .andExpect(status().isOk());
    }

    @Test
    void anonymousSetPrimaryTrack_stillRequiresAuthentication() throws Exception {
        mockMvc.perform(put("/api/dances/{danceId}/primary-track", danceId)
                .with(csrf()))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void anonymousSuggestTrack_stillRequiresAuthentication() throws Exception {
        mockMvc.perform(post("/api/dances/{danceId}/tracks/{trackId}", danceId, trackId)
                .with(csrf()))
            .andExpect(status().isUnauthorized());
    }
}
