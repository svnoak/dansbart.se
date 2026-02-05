package se.dansbart.domain.admin.maintenance;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "Admin Maintenance", description = "System maintenance and data management endpoints")
public class MaintenanceController {

    private final MaintenanceService maintenanceService;

    @PostMapping("/danger/reset-crawl-data")
    @Operation(summary = "DANGER: Reset all crawl data (nuclear option)")
    public ResponseEntity<Map<String, Object>> resetCrawlData() {
        return ResponseEntity.ok(maintenanceService.resetCrawlData());
    }

    @PostMapping("/ingest")
    @Operation(summary = "Trigger ingestion of a Spotify resource (playlist, album, or artist)")
    public ResponseEntity<Map<String, Object>> ingest(@RequestBody IngestRequest request) {
        try {
            return ResponseEntity.ok(maintenanceService.ingestResource(request.resourceId(), request.resourceType()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/maintenance/cleanup-orphaned")
    @Operation(summary = "Cleanup tracks stuck in PROCESSING status")
    public ResponseEntity<Map<String, Object>> cleanupOrphaned(
            @RequestParam(defaultValue = "30") int stuckThresholdMinutes) {
        return ResponseEntity.ok(maintenanceService.cleanupOrphanedTracks(stuckThresholdMinutes));
    }

    @GetMapping("/maintenance/isrc-stats")
    @Operation(summary = "Get ISRC statistics")
    public ResponseEntity<Map<String, Object>> getIsrcStats() {
        return ResponseEntity.ok(maintenanceService.getIsrcStats());
    }

    @PostMapping("/reclassify-all")
    @Operation(summary = "Trigger heuristic reclassification for all tracks")
    public ResponseEntity<Map<String, Object>> reclassifyAll() {
        return ResponseEntity.ok(maintenanceService.reclassifyAll());
    }

    @PostMapping("/maintenance/backfill-isrcs")
    @Operation(summary = "Backfill ISRCs from Spotify")
    public ResponseEntity<Map<String, Object>> backfillIsrcs(
            @RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok(maintenanceService.backfillIsrcs(limit));
    }

    public record IngestRequest(String resourceId, String resourceType) {
        public IngestRequest {
            if (resourceType == null) resourceType = "playlist";
        }
    }
}
