package se.dansbart.domain.analytics;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping(value = "/api/analytics", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Analytics", description = "Track playback and user interaction analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @PostMapping("/playback/{trackId}")
    @Operation(summary = "Record a track playback event")
    public ResponseEntity<TrackPlayback> recordPlayback(
            @PathVariable UUID trackId,
            @RequestBody RecordPlaybackRequest request) {
        TrackPlayback playback = analyticsService.recordPlayback(
            trackId,
            request.platform(),
            request.durationSeconds(),
            request.completed(),
            request.sessionId()
        );
        return ResponseEntity.ok(playback);
    }

    @PostMapping({"/interaction", "/track/interaction"})
    @Operation(summary = "Record a user interaction event")
    public ResponseEntity<UserInteraction> recordInteraction(@RequestBody RecordInteractionRequest request) {
        UserInteraction interaction = analyticsService.recordInteraction(
            request.trackId(),
            request.eventType(),
            request.eventData(),
            request.sessionId()
        );
        return ResponseEntity.ok(interaction);
    }

    @PostMapping("/session")
    @Operation(summary = "Create or update a visitor session")
    public ResponseEntity<VisitorSession> createOrUpdateSession(@RequestBody SessionRequest request) {
        VisitorSession session = analyticsService.createOrUpdateSession(
            request.sessionId(),
            request.userAgent(),
            request.isAuthenticated(),
            request.deviceType()
        );
        return ResponseEntity.ok(session);
    }

    @PostMapping("/session/flag")
    @Operation(summary = "Mark that this session touched a site area (search, playlists, library, discovery)")
    public ResponseEntity<Void> recordSessionFlag(@RequestBody SessionFlagRequest request) {
        analyticsService.recordBehavioralFlag(request.sessionId(), request.area());
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @PostMapping("/path")
    @Operation(summary = "Record a path navigation for aggregate counting")
    public ResponseEntity<Void> recordPathView(@RequestBody PathViewRequest request) {
        analyticsService.recordPathView(request.path());
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    public record RecordPlaybackRequest(String platform, Integer durationSeconds, Boolean completed, String sessionId) {}
    public record RecordInteractionRequest(UUID trackId, String eventType, Map<String, Object> eventData, String sessionId) {}
    public record SessionRequest(String sessionId, String userAgent, Boolean isAuthenticated, String deviceType) {}
    public record SessionFlagRequest(String sessionId, String area) {}
    public record PathViewRequest(String path) {}
}
