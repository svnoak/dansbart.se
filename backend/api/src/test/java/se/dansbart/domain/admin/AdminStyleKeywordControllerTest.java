package se.dansbart.domain.admin;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import se.dansbart.domain.admin.style.AdminStyleKeywordController;
import se.dansbart.domain.admin.style.AdminStyleKeywordService;

import java.util.*;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminStyleKeywordController.class)
class AdminStyleKeywordControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminStyleKeywordService keywordService;

    @Test
    @WithMockUser(roles = "ADMIN")
    void getKeywords_shouldReturnPaginatedList() throws Exception {
        Map<String, Object> response = new HashMap<>();
        response.put("items", List.of(
            Map.of("id", "1", "keyword", "polska", "mainStyle", "polska")
        ));
        response.put("total", 1);
        response.put("limit", 50);
        response.put("offset", 0);

        when(keywordService.getKeywordsPaginated(any(), any(), any(), anyInt(), anyInt()))
            .thenReturn(response);

        mockMvc.perform(get("/api/admin/style-keywords")
                .param("limit", "50")
                .param("offset", "0"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items").isArray())
            .andExpect(jsonPath("$.total").value(1));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getStats_shouldReturnKeywordStatistics() throws Exception {
        Map<String, Object> response = Map.of(
            "total_active", 100,
            "total_inactive", 10,
            "by_style", Map.of("polska", 50, "vals", 30),
            "unique_styles", List.of("polska", "vals", "schottis")
        );

        when(keywordService.getStats()).thenReturn(response);

        mockMvc.perform(get("/api/admin/style-keywords/stats"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total_active").value(100));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getKeyword_shouldReturnSingleKeyword() throws Exception {
        UUID keywordId = UUID.randomUUID();
        Map<String, Object> response = Map.of(
            "id", keywordId.toString(),
            "keyword", "polska",
            "mainStyle", "polska",
            "is_active", true
        );

        when(keywordService.getKeywordById(keywordId)).thenReturn(response);

        mockMvc.perform(get("/api/admin/style-keywords/{keywordId}", keywordId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.keyword").value("polska"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void createKeyword_shouldReturnCreatedKeyword() throws Exception {
        Map<String, Object> keyword = Map.of(
            "id", UUID.randomUUID().toString(),
            "keyword", "hambo",
            "mainStyle", "hambo"
        );

        when(keywordService.createKeyword(anyString(), anyString(), any()))
            .thenReturn(keyword);

        mockMvc.perform(post("/api/admin/style-keywords")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"keyword\":\"hambo\",\"mainStyle\":\"hambo\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("success"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void updateKeyword_shouldReturnUpdatedKeyword() throws Exception {
        UUID keywordId = UUID.randomUUID();
        Map<String, Object> keyword = Map.of(
            "id", keywordId.toString(),
            "keyword", "polska_updated",
            "mainStyle", "polska"
        );

        when(keywordService.updateKeyword(eq(keywordId), any(), any(), any(), any()))
            .thenReturn(keyword);

        mockMvc.perform(put("/api/admin/style-keywords/{keywordId}", keywordId)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"keyword\":\"polska_updated\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("success"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void deleteKeyword_shouldReturnSuccess() throws Exception {
        UUID keywordId = UUID.randomUUID();

        when(keywordService.deleteKeyword(keywordId)).thenReturn(true);

        mockMvc.perform(delete("/api/admin/style-keywords/{keywordId}", keywordId)
                .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("success"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void deleteKeyword_notFound_shouldReturn404() throws Exception {
        UUID keywordId = UUID.randomUUID();

        when(keywordService.deleteKeyword(keywordId)).thenReturn(false);

        mockMvc.perform(delete("/api/admin/style-keywords/{keywordId}", keywordId)
                .with(csrf()))
            .andExpect(status().isNotFound());
    }
}
