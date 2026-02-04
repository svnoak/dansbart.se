package se.dansbart.domain.admin;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import se.dansbart.domain.admin.analytics.AdminAnalyticsController;
import se.dansbart.domain.admin.analytics.AdminAnalyticsService;

import java.util.*;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminAnalyticsController.class)
class AdminAnalyticsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminAnalyticsService analyticsService;

    @Test
    @WithMockUser(roles = "ADMIN")
    void getDashboard_shouldReturnComprehensiveStats() throws Exception {
        Map<String, Object> dashboard = new HashMap<>();
        dashboard.put("visitors", Map.of("total_visitors", 100, "total_page_views", 500));
        dashboard.put("listen_time", Map.of("total_hours", 24));
        dashboard.put("most_played_tracks", List.of());

        when(analyticsService.getDashboard(anyInt())).thenReturn(dashboard);

        mockMvc.perform(get("/api/admin/analytics/dashboard")
                .param("days", "30"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.visitors.total_visitors").value(100));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getVisitorStats_shouldReturnVisitorData() throws Exception {
        Map<String, Object> response = Map.of(
            "total_visitors", 100,
            "total_page_views", 500,
            "days", 30
        );

        when(analyticsService.getVisitorStats(anyInt())).thenReturn(response);

        mockMvc.perform(get("/api/admin/analytics/visitors")
                .param("days", "30"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total_visitors").value(100));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getHourlyVisits_shouldReturnHourlyPattern() throws Exception {
        Map<String, Object> response = Map.of(
            "by_hour", Map.of(9, 10, 10, 15, 11, 20),
            "days", 30
        );

        when(analyticsService.getHourlyVisits(anyInt())).thenReturn(response);

        mockMvc.perform(get("/api/admin/analytics/visits/hourly")
                .param("days", "30"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.by_hour").isMap());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getMostPlayedTracks_shouldReturnTrackList() throws Exception {
        List<Map<String, Object>> tracks = List.of(
            Map.of("track_id", "123", "title", "Test Track", "play_count", 50)
        );

        when(analyticsService.getMostPlayedTracks(anyInt(), any())).thenReturn(tracks);

        mockMvc.perform(get("/api/admin/analytics/tracks/most-played")
                .param("limit", "10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].title").value("Test Track"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getListenTime_shouldReturnTotalTime() throws Exception {
        Map<String, Object> response = Map.of(
            "total_seconds", 86400,
            "total_minutes", 1440,
            "total_hours", 24
        );

        when(analyticsService.getListenTime(any())).thenReturn(response);

        mockMvc.perform(get("/api/admin/analytics/listen-time"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total_hours").value(24));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getPlatformStats_shouldReturnPlatformBreakdown() throws Exception {
        Map<String, Object> response = Map.of(
            "platforms", List.of(
                Map.of("platform", "spotify", "play_count", 100),
                Map.of("platform", "youtube", "play_count", 50)
            )
        );

        when(analyticsService.getPlatformStats(any())).thenReturn(response);

        mockMvc.perform(get("/api/admin/analytics/platform-stats"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.platforms").isArray());
    }
}
