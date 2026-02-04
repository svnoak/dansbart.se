package se.dansbart.domain.admin;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import se.dansbart.domain.admin.artist.AdminArtistController;
import se.dansbart.domain.admin.artist.AdminArtistService;

import java.util.*;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminArtistController.class)
class AdminArtistControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminArtistService artistService;

    @Test
    @WithMockUser(roles = "ADMIN")
    void getArtists_shouldReturnPaginatedList() throws Exception {
        Map<String, Object> response = new HashMap<>();
        response.put("items", List.of(Map.of("id", "123", "name", "Test Artist")));
        response.put("total", 1);
        response.put("limit", 50);
        response.put("offset", 0);

        when(artistService.getArtistsPaginated(any(), any(), anyInt(), anyInt()))
            .thenReturn(response);

        mockMvc.perform(get("/api/admin/artists")
                .param("limit", "50")
                .param("offset", "0"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items").isArray())
            .andExpect(jsonPath("$.total").value(1));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getIsolationStatus_shouldReturnIsolationInfo() throws Exception {
        UUID artistId = UUID.randomUUID();
        Map<String, Object> response = Map.of(
            "is_isolated", true,
            "collaborating_artist_count", 0,
            "shared_album_count", 0,
            "total_tracks", 5
        );

        when(artistService.getArtistIsolationInfo(artistId)).thenReturn(response);

        mockMvc.perform(get("/api/admin/artists/{artistId}/isolation-check", artistId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.is_isolated").value(true));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void approveArtist_shouldReturnSuccess() throws Exception {
        UUID artistId = UUID.randomUUID();
        Map<String, Object> response = Map.of(
            "status", "success",
            "artist_id", artistId.toString(),
            "queued_tracks", 3
        );

        when(artistService.approveArtist(artistId)).thenReturn(response);

        mockMvc.perform(post("/api/admin/artists/{artistId}/approve", artistId)
                .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("success"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void rejectArtist_shouldReturnSuccess() throws Exception {
        UUID artistId = UUID.randomUUID();
        Map<String, Object> response = Map.of(
            "status", "success",
            "artist_id", artistId.toString(),
            "message", "Artist rejected and added to blocklist"
        );

        when(artistService.rejectArtist(eq(artistId), anyString(), anyBoolean(), anyBoolean()))
            .thenReturn(response);

        mockMvc.perform(post("/api/admin/artists/{artistId}/reject", artistId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Not relevant\",\"dryRun\":false,\"deleteContent\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("success"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void bulkApproveArtists_shouldReturnSuccess() throws Exception {
        Map<String, Object> response = Map.of(
            "status", "success",
            "approved", 2,
            "queued_tracks", 10,
            "failed", List.of()
        );

        when(artistService.bulkApproveArtists(anyList())).thenReturn(response);

        mockMvc.perform(post("/api/admin/artists/bulk-approve")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"ids\":[\"id1\",\"id2\"]}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.approved").value(2));
    }
}
