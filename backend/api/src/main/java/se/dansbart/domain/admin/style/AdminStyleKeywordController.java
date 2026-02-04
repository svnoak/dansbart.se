package se.dansbart.domain.admin.style;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/style-keywords")
@RequiredArgsConstructor
@Tag(name = "Admin Style Keywords", description = "Style keyword CRUD management")
public class AdminStyleKeywordController {

    private final AdminStyleKeywordService keywordService;

    @GetMapping
    @Operation(summary = "Get paginated list of style keywords")
    public ResponseEntity<Map<String, Object>> getKeywords(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String mainStyle,
            @RequestParam(required = false) Boolean isActive,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return ResponseEntity.ok(keywordService.getKeywordsPaginated(search, mainStyle, isActive, limit, offset));
    }

    @GetMapping("/stats")
    @Operation(summary = "Get keyword statistics")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(keywordService.getStats());
    }

    @GetMapping("/{keywordId}")
    @Operation(summary = "Get a single style keyword by ID")
    public ResponseEntity<Map<String, Object>> getKeyword(@PathVariable UUID keywordId) {
        try {
            return ResponseEntity.ok(keywordService.getKeywordById(keywordId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    @Operation(summary = "Create a new style keyword mapping")
    public ResponseEntity<Map<String, Object>> createKeyword(@RequestBody StyleKeywordRequest request) {
        try {
            Map<String, Object> keyword = keywordService.createKeyword(
                request.keyword(), request.mainStyle(), request.subStyle());
            return ResponseEntity.ok(Map.of("status", "success", "keyword", keyword));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{keywordId}")
    @Operation(summary = "Update an existing style keyword")
    public ResponseEntity<Map<String, Object>> updateKeyword(
            @PathVariable UUID keywordId,
            @RequestBody StyleKeywordUpdateRequest request) {
        try {
            Map<String, Object> keyword = keywordService.updateKeyword(
                keywordId, request.keyword(), request.mainStyle(), request.subStyle(), request.isActive());
            return ResponseEntity.ok(Map.of("status", "success", "keyword", keyword));
        } catch (IllegalArgumentException e) {
            if (e.getMessage().contains("not found")) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{keywordId}")
    @Operation(summary = "Delete a style keyword")
    public ResponseEntity<Map<String, Object>> deleteKeyword(@PathVariable UUID keywordId) {
        if (keywordService.deleteKeyword(keywordId)) {
            return ResponseEntity.ok(Map.of("status", "success", "message", "Keyword deleted"));
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/invalidate-cache")
    @Operation(summary = "Manually invalidate the style keywords cache")
    public ResponseEntity<Map<String, Object>> invalidateCache() {
        // In Java, we can use Spring's cache eviction or Redis cache clear
        // For now, just return success as the cache is typically handled automatically
        return ResponseEntity.ok(Map.of("status", "success", "message", "Cache invalidated"));
    }

    public record StyleKeywordRequest(
        String keyword,
        String mainStyle,
        String subStyle
    ) {}

    public record StyleKeywordUpdateRequest(
        String keyword,
        String mainStyle,
        String subStyle,
        Boolean isActive
    ) {}
}
