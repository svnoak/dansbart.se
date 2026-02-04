package se.dansbart.domain.admin.spider;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/spider")
@RequiredArgsConstructor
@Tag(name = "Admin Spider", description = "Spider crawl management endpoints")
public class AdminSpiderController {

    private final AdminSpiderService spiderService;

    @PostMapping("/crawl")
    @Operation(summary = "Trigger a spider crawl")
    public ResponseEntity<Map<String, Object>> triggerCrawl(
            @RequestParam(defaultValue = "discover") String mode,
            @RequestParam(defaultValue = "100") int maxDiscoveries,
            @RequestParam(defaultValue = "false") boolean discoverFromAlbums) {
        return ResponseEntity.ok(spiderService.triggerSpiderCrawl(mode, maxDiscoveries, discoverFromAlbums));
    }

    @GetMapping("/history")
    @Operation(summary = "Get spider crawl history")
    public ResponseEntity<Map<String, Object>> getCrawlHistory(
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return ResponseEntity.ok(spiderService.getCrawlHistory(limit, offset));
    }

    @GetMapping("/stats")
    @Operation(summary = "Get spider statistics")
    public ResponseEntity<Map<String, Object>> getSpiderStats() {
        return ResponseEntity.ok(spiderService.getSpiderStats());
    }
}
