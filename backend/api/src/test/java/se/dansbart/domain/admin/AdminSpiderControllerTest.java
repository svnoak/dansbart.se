package se.dansbart.domain.admin;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import se.dansbart.domain.admin.spider.AdminSpiderController;
import se.dansbart.domain.admin.spider.AdminSpiderService;

import java.util.*;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminSpiderController.class)
class AdminSpiderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminSpiderService spiderService;

    @Test
    @WithMockUser(roles = "ADMIN")
    void triggerCrawl_shouldQueueTask() throws Exception {
        Map<String, Object> response = Map.of(
            "status", "queued",
            "message", "Spider crawl queued in background (discover mode)",
            "task_id", UUID.randomUUID().toString()
        );

        when(spiderService.triggerSpiderCrawl(anyString(), anyInt(), anyBoolean()))
            .thenReturn(response);

        mockMvc.perform(post("/api/admin/spider/crawl")
                .with(csrf())
                .param("mode", "discover")
                .param("maxDiscoveries", "100"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("queued"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getCrawlHistory_shouldReturnPaginatedList() throws Exception {
        Map<String, Object> response = new HashMap<>();
        response.put("items", List.of(
            Map.of("id", "1", "artist_name", "Test Artist", "tracks_found", 10)
        ));
        response.put("total", 1);
        response.put("limit", 50);
        response.put("offset", 0);

        when(spiderService.getCrawlHistory(anyInt(), anyInt())).thenReturn(response);

        mockMvc.perform(get("/api/admin/spider/history")
                .param("limit", "50")
                .param("offset", "0"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items").isArray())
            .andExpect(jsonPath("$.total").value(1));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getSpiderStats_shouldReturnStats() throws Exception {
        Map<String, Object> response = Map.of(
            "total_artists_crawled", 100,
            "total_tracks_found", 500,
            "by_genre", Map.of("nordic_folk", 80, "other", 20),
            "by_status", Map.of("success", 90, "rejected", 10)
        );

        when(spiderService.getSpiderStats()).thenReturn(response);

        mockMvc.perform(get("/api/admin/spider/stats"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total_artists_crawled").value(100))
            .andExpect(jsonPath("$.total_tracks_found").value(500));
    }
}
