package se.dansbart.domain.track;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import se.dansbart.dto.PageResponse;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/tracks")
@RequiredArgsConstructor
@Tag(name = "Tracks", description = "Track discovery and playback endpoints")
public class TrackController {

    private final TrackService trackService;
    private final TrackFeedbackService feedbackService;

    @GetMapping
    @Operation(summary = "Get playable tracks with optional filters")
    public ResponseEntity<PageResponse<Track>> getTracks(
            @RequestParam(name = "main_style", required = false) String mainStyle,
            @RequestParam(name = "sub_style", required = false) String subStyle,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String vocals,
            @RequestParam(name = "style_confirmed", required = false) Boolean styleConfirmed,
            @RequestParam(name = "music_genre", required = false) String musicGenre,
            @RequestParam(name = "min_bpm", required = false) Integer minBpm,
            @RequestParam(name = "max_bpm", required = false) Integer maxBpm,
            @RequestParam(name = "min_duration", required = false) Integer minDuration,
            @RequestParam(name = "max_duration", required = false) Integer maxDuration,
            @RequestParam(name = "min_bounciness", required = false) Float minBounciness,
            @RequestParam(name = "max_bounciness", required = false) Float maxBounciness,
            @RequestParam(name = "min_articulation", required = false) Float minArticulation,
            @RequestParam(name = "max_articulation", required = false) Float maxArticulation,
            @RequestParam(defaultValue = "20") Integer limit,
            @RequestParam(defaultValue = "0") Integer offset) {
        Page<Track> page = trackService.findPlayableTracks(
            mainStyle, subStyle, search, source, vocals, styleConfirmed, musicGenre,
            minBpm, maxBpm, minDuration, maxDuration,
            minBounciness, maxBounciness, minArticulation, maxArticulation,
            limit, offset
        );
        return ResponseEntity.ok(PageResponse.from(page));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get track by ID")
    public ResponseEntity<Track> getTrack(@PathVariable UUID id) {
        return trackService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/similar")
    @Operation(summary = "Get similar tracks using embedding similarity")
    public ResponseEntity<List<Track>> getSimilarTracks(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(trackService.findSimilarTracks(id, limit));
    }

    @GetMapping("/search")
    @Operation(summary = "Search tracks by title")
    public ResponseEntity<PageResponse<Track>> searchTracks(
            @RequestParam String q,
            Pageable pageable) {
        return ResponseEntity.ok(PageResponse.from(trackService.searchByTitle(q, pageable)));
    }

    @PostMapping("/{id}/feedback")
    @Operation(summary = "Submit style correction feedback for a track")
    public ResponseEntity<TrackStyleVote> submitFeedback(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody FeedbackRequest request) {
        String voterId = jwt.getSubject();
        return feedbackService.submitStyleFeedback(id, voterId, request.suggestedStyle(), request.tempoCorrection())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/confirm-secondary")
    @Operation(summary = "Confirm a secondary dance style without affecting primary election")
    public ResponseEntity<Map<String, Object>> confirmSecondaryStyle(
            @PathVariable UUID id,
            @RequestBody SecondaryStyleRequest request) {
        return feedbackService.confirmSecondaryStyle(id, request.style())
            .map(result -> {
                result.put("status", "success");
                result.put("message", "Secondary style confirmed.");
                return ResponseEntity.ok(result);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/movement")
    @Operation(summary = "Submit movement tags for a track")
    public ResponseEntity<Map<String, Object>> submitMovementVote(
            @PathVariable UUID id,
            @RequestBody MovementVoteRequest request) {
        if (feedbackService.processMovementFeedback(id, request.danceStyle(), request.tags())) {
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Movement feedback recorded"
            ));
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/flag")
    @Operation(summary = "Flag a track as not being folk music")
    public ResponseEntity<Map<String, Object>> flagTrack(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "not_folk_music") String reason) {
        return feedbackService.flagTrack(id, reason)
            .map(result -> {
                result.put("status", "success");
                result.put("message", "Track flagged successfully");
                return ResponseEntity.ok(result);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}/flag")
    @Operation(summary = "Remove flag from a track (admin override)")
    public ResponseEntity<Map<String, Object>> unflagTrack(@PathVariable UUID id) {
        return feedbackService.unflagTrack(id)
            .map(result -> {
                result.put("status", "success");
                result.put("message", "Track unflagged successfully");
                return ResponseEntity.ok(result);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/structure")
    @Operation(summary = "Submit a structure proposal (creates candidate version)")
    public ResponseEntity<Map<String, Object>> submitStructureProposal(
            @PathVariable UUID id,
            @RequestParam(required = false) String description,
            @RequestBody StructureRequest request) {
        return feedbackService.createStructureVersion(
                id,
                request.bars(),
                request.sections(),
                request.sectionLabels(),
                description,
                request.authorAlias()
            )
            .map(version -> {
                Map<String, Object> response = new HashMap<>();
                response.put("status", "success");
                response.put("message", "Version created");
                response.put("version_id", version.getId());
                response.put("is_active", version.getIsActive());
                return ResponseEntity.ok(response);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/structure-versions")
    @Operation(summary = "Get list of structure versions for a track")
    public ResponseEntity<List<TrackStructureVersion>> getStructureVersions(@PathVariable UUID id) {
        return ResponseEntity.ok(feedbackService.getStructureVersions(id));
    }

    @PostMapping("/{id}/links")
    @Operation(summary = "Submit a new playback link for a track")
    public ResponseEntity<PlaybackLink> submitLink(
            @PathVariable UUID id,
            @RequestBody SubmitLinkRequest request) {
        return trackService.submitLink(id, request.platform(), request.deepLink())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.badRequest().build());
    }

    @PatchMapping("/links/{linkId}/report")
    @Operation(summary = "Report a broken playback link")
    public ResponseEntity<Void> reportBrokenLink(@PathVariable UUID linkId) {
        if (trackService.reportBrokenLink(linkId)) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    // Request DTOs
    public record FeedbackRequest(String suggestedStyle, String tempoCorrection) {}
    public record SubmitLinkRequest(String platform, String deepLink) {}
    public record SecondaryStyleRequest(String style) {}
    public record MovementVoteRequest(String danceStyle, List<String> tags) {}
    public record StructureRequest(
        List<Float> bars,
        List<Float> sections,
        List<String> sectionLabels,
        String authorAlias
    ) {}
}
