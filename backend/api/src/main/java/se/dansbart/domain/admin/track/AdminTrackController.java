package se.dansbart.domain.admin.track;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/tracks")
@RequiredArgsConstructor
@Tag(name = "Admin - Tracks", description = "Admin track management endpoints")
public class AdminTrackController {

    private final AdminTrackService adminTrackService;

    @GetMapping
    @Operation(summary = "Get all tracks with filtering")
    public ResponseEntity<AdminTrackPageResponse> getTracks(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean flagged,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        Page<AdminTrackDto> page = adminTrackService.getTracks(search, status, flagged, limit, offset);
        return ResponseEntity.ok(AdminTrackPageResponse.from(page));
    }

    @PostMapping("/{trackId}/reanalyze")
    @Operation(summary = "Force complete re-analysis of a track")
    public ResponseEntity<Map<String, Object>> reanalyzeTrack(@PathVariable UUID trackId) {
        try {
            return ResponseEntity.ok(adminTrackService.triggerReanalysis(trackId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/bulk-reanalyze")
    @Operation(summary = "Bulk re-analyze tracks based on status filter")
    public ResponseEntity<Map<String, Object>> bulkReanalyze(
            @RequestBody BulkReanalyzeRequest request) {
        return ResponseEntity.ok(adminTrackService.triggerBulkReanalysis(
            request.statusFilter() != null ? request.statusFilter() : "PENDING",
            request.limit() != null ? request.limit() : 100
        ));
    }

    @PostMapping("/{trackId}/reclassify")
    @Operation(summary = "Re-run classification only (no audio re-download)")
    public ResponseEntity<Map<String, Object>> reclassifyTrack(@PathVariable UUID trackId) {
        try {
            return ResponseEntity.ok(adminTrackService.triggerReclassify(trackId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{trackId}")
    @Operation(summary = "Delete a track without adding to blocklist")
    public ResponseEntity<Map<String, Object>> deleteTrack(@PathVariable UUID trackId) {
        try {
            return ResponseEntity.ok(adminTrackService.deleteTrack(trackId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{trackId}/reject")
    @Operation(summary = "Reject track and add to blocklist")
    public ResponseEntity<Map<String, Object>> rejectTrack(
            @PathVariable UUID trackId,
            @RequestBody(required = false) RejectRequest request) {
        try {
            String reason = request != null && request.reason() != null ? request.reason() : "Not relevant";
            boolean dryRun = request != null && request.dryRun() != null && request.dryRun();
            return ResponseEntity.ok(adminTrackService.rejectTrack(trackId, reason, dryRun));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{trackId}/structure/reset")
    @Operation(summary = "Reset track structure to AI defaults")
    public ResponseEntity<Map<String, Object>> resetStructure(@PathVariable UUID trackId) {
        try {
            return ResponseEntity.ok(adminTrackService.resetTrackStructure(trackId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{trackId}/flag")
    @Operation(summary = "Remove flag from a track (admin override)")
    public ResponseEntity<Map<String, Object>> unflagTrack(@PathVariable UUID trackId) {
        return adminTrackService.unflagTrack(trackId)
            .map(result -> {
                result.put("status", "success");
                result.put("message", "Track unflagged successfully");
                return ResponseEntity.ok(result);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    public record BulkReanalyzeRequest(String statusFilter, Integer limit) {}
    public record RejectRequest(String reason, Boolean dryRun, Boolean deleteContent) {}
}
