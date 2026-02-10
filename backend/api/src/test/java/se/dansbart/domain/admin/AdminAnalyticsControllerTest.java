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
        dashboard.put("visitors", Map.of("totalVisitors", 100, "totalPageViews", 500));
        dashboard.put("listenTime", Map.of("totalHours", 24));
        dashboard.put("mostPlayedTracks", List.of());

        when(analyticsService.getDashboard(anyInt())).thenReturn(dashboard);

        mockMvc.perform(get("/api/admin/analytics/dashboard")
                .param("days", "30"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.visitors.totalVisitors").value(100));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getVisitorStats_shouldReturnVisitorData() throws Exception {
        Map<String, Object> response = Map.of(
            "totalVisitors", 100,
            "totalPageViews", 500,
            "days", 30
        );

        when(analyticsService.getVisitorStats(anyInt())).thenReturn(response);

        mockMvc.perform(get("/api/admin/analytics/visitors")
                .param("days", "30"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalVisitors").value(100));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getHourlyVisits_shouldReturnHourlyPattern() throws Exception {
        Map<String, Object> response = Map.of(
            "byHour", Map.of(9, 10, 10, 15, 11, 20),
            "days", 30
        );

        when(analyticsService.getHourlyVisits(anyInt())).thenReturn(response);

        mockMvc.perform(get("/api/admin/analytics/visits/hourly")
                .param("days", "30"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.byHour").isMap());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getMostPlayedTracks_shouldReturnTrackList() throws Exception {
        List<Map<String, Object>> tracks = List.of(
            Map.of("trackId", "123", "title", "Test Track", "playCount", 50)
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
            "totalSeconds", 86400,
            "totalMinutes", 1440,
            "totalHours", 24
        );

        when(analyticsService.getListenTime(any())).thenReturn(response);

        mockMvc.perform(get("/api/admin/analytics/listen-time"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalHours").value(24));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getPlatformStats_shouldReturnPlatformBreakdown() throws Exception {
        Map<String, Object> response = Map.of(
            "platforms", List.of(
                Map.of("platform", "spotify", "playCount", 100),
                Map.of("platform", "youtube", "playCount", 50)
            )
        );

        when(analyticsService.getPlatformStats(any())).thenReturn(response);

        mockMvc.perform(get("/api/admin/analytics/platform-stats"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.platforms").isArray());
    }
}
