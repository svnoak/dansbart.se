package se.dansbart.domain.admin.maintenance;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import org.springframework.http.MediaType;

@RestController
@RequestMapping(value = "/api/admin", produces = MediaType.APPLICATION_JSON_VALUE)
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

    @PostMapping("/maintenance/queue-pending-tracks")
    @Operation(summary = "Queue tracks for audio analysis by status",
        description = "Dispatches up to 'limit' tracks with the given status to the audio worker. "
            + "Supports PENDING (default) and FAILED. FAILED tracks are reset to PENDING before dispatch.")
    public ResponseEntity<Map<String, Object>> queuePendingTracks(
            @RequestParam(defaultValue = "500") int limit,
            @RequestParam(defaultValue = "PENDING") String status) {
        return ResponseEntity.ok(maintenanceService.queuePendingTracksForAnalysis(limit, status));
    }

    @PostMapping("/maintenance/reanalyze")
    @Operation(summary = "Queue DONE tracks for re-analysis",
        description = "Sets DONE tracks to REANALYZING and dispatches audio analysis. "
            + "Tracks remain visible in search results while being re-analyzed.")
    public ResponseEntity<Map<String, Object>> reanalyze(
            @RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok(maintenanceService.reanalyzeTracksForAnalysis(limit));
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

    @PostMapping("/maintenance/backfill-duration")
    @Operation(summary = "Backfill missing duration from Spotify")
    public ResponseEntity<Map<String, Object>> backfillDuration(
            @RequestParam(defaultValue = "200") int batchSize) {
        return ResponseEntity.ok(maintenanceService.backfillDuration(batchSize));
    }

    @PostMapping("/maintenance/backfill-isrcs")
    @Operation(summary = "Backfill ISRCs from Spotify")
    public ResponseEntity<Map<String, Object>> backfillIsrcs(
            @RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok(maintenanceService.backfillIsrcs(limit));
    }

    @PostMapping("/maintenance/pause")
    @Operation(summary = "Pause task dispatching for a queue (or all queues)",
        description = "Sets a pause flag and purges pending messages. Workers finish current work but receive nothing new.")
    public ResponseEntity<Map<String, Object>> pause(
            @RequestParam(required = false) String queue) {
        if (queue != null && !queue.isBlank()) {
            return ResponseEntity.ok(maintenanceService.pauseQueue(queue));
        }
        return ResponseEntity.ok(maintenanceService.pauseAll());
    }

    @PostMapping("/maintenance/resume")
    @Operation(summary = "Resume task dispatching for a queue (or all queues)")
    public ResponseEntity<Map<String, Object>> resume(
            @RequestParam(required = false) String queue) {
        if (queue != null && !queue.isBlank()) {
            return ResponseEntity.ok(maintenanceService.resumeQueue(queue));
        }
        return ResponseEntity.ok(maintenanceService.resumeAll());
    }

    @GetMapping("/maintenance/pause-status")
    @Operation(summary = "Get pause status for all queues")
    public ResponseEntity<Map<String, Object>> getPauseStatus() {
        return ResponseEntity.ok(maintenanceService.getPauseStatus());
    }

    public record IngestRequest(String resourceId, String resourceType) {
        public IngestRequest {
            if (resourceType == null) resourceType = "playlist";
        }
    }
}
