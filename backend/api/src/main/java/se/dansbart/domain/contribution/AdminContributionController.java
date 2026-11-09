package se.dansbart.domain.contribution;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import se.dansbart.dto.AdminContributionCountDto;
import se.dansbart.dto.AdminContributionsDto;

import java.util.UUID;

@RestController
@RequestMapping(value = "/api/admin/contributions", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Admin: Contributions", description = "Review tracks and dance styles that users added")
public class AdminContributionController {

    private final AdminContributionService service;

    @GetMapping
    @Operation(operationId = "getUnreviewedContributions", summary = "List user additions no admin has reviewed")
    public ResponseEntity<AdminContributionsDto> list() {
        return ResponseEntity.ok(service.listUnreviewed());
    }

    @GetMapping("/count")
    @Operation(operationId = "countUnreviewedContributions", summary = "Count user additions no admin has reviewed")
    public ResponseEntity<AdminContributionCountDto> count() {
        return ResponseEntity.ok(service.countUnreviewed());
    }

    @PostMapping("/tracks/{submissionId}/approve")
    @Operation(operationId = "approveTrackContribution", summary = "Keep a user-added track and clear it from the queue")
    public ResponseEntity<Void> approveTrack(@PathVariable UUID submissionId, @AuthenticationPrincipal UUID adminId) {
        service.approveTrack(submissionId, adminId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/tracks/{submissionId}/remove")
    @Operation(operationId = "removeTrackContribution", summary = "Delete the track a user added")
    public ResponseEntity<Void> removeTrack(@PathVariable UUID submissionId, @AuthenticationPrincipal UUID adminId) {
        service.removeTrack(submissionId, adminId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/styles/{styleId}/approve")
    @Operation(operationId = "approveStyleContribution", summary = "Keep a user-added dance style and clear it from the queue")
    public ResponseEntity<Void> approveStyle(@PathVariable UUID styleId) {
        service.approveStyle(styleId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/styles/{styleId}/remove")
    @Operation(operationId = "removeStyleContribution", summary = "Hide a user-added dance style")
    public ResponseEntity<Void> removeStyle(@PathVariable UUID styleId) {
        service.removeStyle(styleId);
        return ResponseEntity.noContent().build();
    }
}
