package se.dansbart.domain.submission;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import se.dansbart.config.SecurityConfig;
import se.dansbart.dto.TrackSubmissionBatchDto;
import se.dansbart.dto.TrackSubmissionDto;
import se.dansbart.exception.BadRequestException;
import se.dansbart.exception.ResourceNotFoundException;
import se.dansbart.voter.VoterContext;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Runs against the production SecurityConfig: adding music must work without a
 * session and without a CSRF token, like votes and suggestions do.
 */
@WebMvcTest(TrackSubmissionController.class)
@Import(SecurityConfig.class)
@ActiveProfiles("securityfilterchaintest")
class TrackSubmissionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TrackSubmissionService service;

    @MockBean
    private VoterContext voterContext;

    @Test
    void anonymousPost_isAllowedWithoutCsrf() throws Exception {
        UUID batchId = UUID.randomUUID();
        TrackSubmissionDto item = TrackSubmissionDto.builder().id(UUID.randomUUID()).batchId(batchId)
            .title("Polska").status("pending").suggestedMainStyle("Polska").build();
        when(service.submit("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"))
            .thenReturn(TrackSubmissionBatchDto.builder().batchId(batchId).provider("spotify").sourceKind("track")
                .needsReview(true).items(List.of(item)).build());

        mockMvc.perform(post("/api/submissions")
                .header("X-Voter-ID", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"url\":\"https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.batchId").value(batchId.toString()))
            .andExpect(jsonPath("$.needsReview").value(true))
            .andExpect(jsonPath("$.items[0].status").value("pending"))
            .andExpect(jsonPath("$.items[0].suggestedMainStyle").value("Polska"));
    }

    @Test
    void blankUrl_isBadRequest() throws Exception {
        mockMvc.perform(post("/api/submissions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"url\":\"  \"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void serviceErrors_mapToStatusCodes() throws Exception {
        when(service.submit(eq("bad"))).thenThrow(new BadRequestException("not a link"));
        when(service.submit(eq("missing"))).thenThrow(new ResourceNotFoundException("nothing"));

        mockMvc.perform(post("/api/submissions").contentType(MediaType.APPLICATION_JSON).content("{\"url\":\"bad\"}"))
            .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/submissions").contentType(MediaType.APPLICATION_JSON).content("{\"url\":\"missing\"}"))
            .andExpect(status().isNotFound());
    }

    @Test
    void anonymousGetBatch_isAllowed() throws Exception {
        UUID batchId = UUID.randomUUID();
        when(service.getBatch(batchId))
            .thenReturn(TrackSubmissionBatchDto.builder().batchId(batchId).items(List.of()).build());

        mockMvc.perform(get("/api/submissions/batch/{id}", batchId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.batchId").value(batchId.toString()));
    }
}
