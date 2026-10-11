package se.dansbart.domain.submission;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import se.dansbart.config.SecurityConfig;
import se.dansbart.dto.TrackSubmissionDto;
import se.dansbart.dto.TrackSubmissionPageDto;
import se.dansbart.dto.request.ApproveSubmissionRequest;
import se.dansbart.voter.VoterContext;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Runs against the production SecurityConfig so the admin-only rule is real. */
@WebMvcTest(AdminTrackSubmissionController.class)
@Import(SecurityConfig.class)
@ActiveProfiles("securityfilterchaintest")
class AdminTrackSubmissionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TrackSubmissionService service;

    @MockBean
    private VoterContext voterContext;

    @Test
    @WithMockUser(roles = "ADMIN")
    void list_defaultsToPending() throws Exception {
        TrackSubmissionDto item = TrackSubmissionDto.builder().id(UUID.randomUUID()).title("Polska")
            .status("pending").submitterName("anna").build();
        when(service.listForAdmin("pending", 50, 0))
            .thenReturn(TrackSubmissionPageDto.builder().items(List.of(item)).total(1).limit(50).offset(0).build());

        mockMvc.perform(get("/api/admin/submissions"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total").value(1))
            .andExpect(jsonPath("$.items[0].submitterName").value("anna"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void approve_passesTheChosenStyle() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.approve(eq(id), any(), eq(new ApproveSubmissionRequest("Vals", null))))
            .thenReturn(TrackSubmissionDto.builder().id(id).status("approved").build());

        mockMvc.perform(post("/api/admin/submissions/{id}/approve", id)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mainStyle\":\"Vals\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("approved"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void approve_withoutBody_isAllowed() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.approve(eq(id), any(), eq(null)))
            .thenReturn(TrackSubmissionDto.builder().id(id).status("approved").build());

        mockMvc.perform(post("/api/admin/submissions/{id}/approve", id).with(csrf()))
            .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void reject_passesTheNote() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.reject(eq(id), any(), eq("Inte dansmusik")))
            .thenReturn(TrackSubmissionDto.builder().id(id).status("rejected").build());

        mockMvc.perform(post("/api/admin/submissions/{id}/reject", id)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reviewNote\":\"Inte dansmusik\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("rejected"));
    }

    @Test
    @WithMockUser(roles = "USER")
    void nonAdmin_isForbidden() throws Exception {
        mockMvc.perform(get("/api/admin/submissions"))
            .andExpect(status().isForbidden());
    }
}
