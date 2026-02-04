package se.dansbart.domain.track;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/structure-versions")
@RequiredArgsConstructor
@Tag(name = "Structure Versions", description = "Track structure version voting and reporting")
public class StructureVersionController {

    private final TrackFeedbackService feedbackService;

    @PostMapping("/{versionId}/vote")
    @Operation(summary = "Upvote/downvote a specific structure version")
    public ResponseEntity<Map<String, Object>> voteOnVersion(
            @PathVariable UUID versionId,
            @RequestBody VoteRequest request) {
        return feedbackService.voteOnStructure(versionId, request.voteType())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{versionId}/report")
    @Operation(summary = "Flag a structure version as spam/bogus")
    public ResponseEntity<Map<String, Object>> reportVersion(@PathVariable UUID versionId) {
        feedbackService.reportStructure(versionId);
        return ResponseEntity.ok(Map.of(
            "status", "success",
            "message", "Version reported"
        ));
    }

    public record VoteRequest(String voteType) {}
}
