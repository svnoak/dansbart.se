package se.dansbart.domain.submission;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.dansbart.dto.TrackSubmissionDto;
import se.dansbart.dto.TrackSubmissionPageDto;
import se.dansbart.dto.request.ApproveSubmissionRequest;
import se.dansbart.dto.request.RejectSubmissionRequest;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping(value = "/api/admin/submissions", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Admin Track Submissions", description = "Review tracks people added from Spotify or YouTube links")
public class AdminTrackSubmissionController {

    private final TrackSubmissionService service;

    @GetMapping
    @Operation(operationId = "listTrackSubmissions", summary = "List submissions, newest first")
    public ResponseEntity<TrackSubmissionPageDto> list(
            @RequestParam(required = false, defaultValue = "pending") String status,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        return ResponseEntity.ok(service.listForAdmin(status, safeLimit, Math.max(0, offset)));
    }

    @GetMapping("/pending-count")
    @Operation(operationId = "countPendingTrackSubmissions", summary = "How many submissions wait for review")
    public ResponseEntity<Map<String, Long>> pendingCount() {
        return ResponseEntity.ok(Map.of("pending", service.countPending()));
    }

    @PostMapping("/{id}/approve")
    @Operation(operationId = "approveTrackSubmission",
        summary = "Create the track, send it for analysis and reward a signed-in submitter")
    public ResponseEntity<TrackSubmissionDto> approve(
            @PathVariable UUID id,
            @RequestBody(required = false) ApproveSubmissionRequest request,
            @AuthenticationPrincipal UUID adminId) {
        return ResponseEntity.ok(service.approve(id, adminId, request));
    }

    @PostMapping("/{id}/reject")
    @Operation(operationId = "rejectTrackSubmission", summary = "Turn a submission down")
    public ResponseEntity<TrackSubmissionDto> reject(
            @PathVariable UUID id,
            @RequestBody(required = false) RejectSubmissionRequest request,
            @AuthenticationPrincipal UUID adminId) {
        return ResponseEntity.ok(service.reject(id, adminId, request != null ? request.reviewNote() : null));
    }

    @PostMapping("/batch/{batchId}/approve")
    @Operation(operationId = "approveTrackSubmissionBatch", summary = "Approve every pending track from one link")
    public ResponseEntity<List<TrackSubmissionDto>> approveBatch(
            @PathVariable UUID batchId,
            @AuthenticationPrincipal UUID adminId) {
        return ResponseEntity.ok(service.approveBatch(batchId, adminId));
    }
}
