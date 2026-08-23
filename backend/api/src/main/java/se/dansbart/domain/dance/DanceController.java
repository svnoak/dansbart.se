package se.dansbart.domain.dance;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.dansbart.dto.DanceDto;
import se.dansbart.dto.PageResponse;
import se.dansbart.dto.TrackListDto;
import se.dansbart.dto.request.DanceTrackVoteRequest;
import se.dansbart.dto.request.SetPrimaryTrackRequest;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.LinkedHashMap;

@RestController
@RequestMapping(value = "/api/dances", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Dances", description = "Dance directory endpoints")
public class DanceController {

    private final DanceService danceService;
    private final DancePrimaryTrackService dancePrimaryTrackService;

    @GetMapping
    @Operation(summary = "List dances with optional search, style filter, and pagination")
    public ResponseEntity<PageResponse<DanceDto>> getDances(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String danceType,
            @RequestParam(defaultValue = "20") Integer limit,
            @RequestParam(defaultValue = "0") Integer offset) {
        var pageable = PageRequest.of(offset / limit, limit);
        return ResponseEntity.ok(PageResponse.from(danceService.getDances(search, danceType, pageable)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get dance by ID")
    public ResponseEntity<DanceDto> getDance(@PathVariable UUID id) {
        return danceService.getDanceById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/tracks")
    @Operation(summary = "Get confirmed tracks for a dance")
    public ResponseEntity<List<TrackListDto>> getDanceTracks(@PathVariable UUID id) {
        return ResponseEntity.ok(danceService.getConfirmedTracksForDance(id));
    }

    @GetMapping("/{id}/recommendations")
    @Operation(summary = "Get track recommendations for a dance based on the same dance style")
    public ResponseEntity<PageResponse<TrackListDto>> getRecommendations(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "5") Integer limit,
            @RequestParam(defaultValue = "0") Integer offset) {
        return ResponseEntity.ok(PageResponse.from(danceService.getRecommendations(id, limit, offset)));
    }

    @GetMapping("/{id}/matching")
    @Operation(summary = "Get community-upvoted tracks for a dance")
    public ResponseEntity<List<TrackListDto>> getMatchingTracks(@PathVariable UUID id) {
        return ResponseEntity.ok(danceService.getMatchingTracks(id));
    }

    @PostMapping("/{id}/tracks/{trackId}/vote")
    @Operation(summary = "Vote on a recommended track for a dance")
    public ResponseEntity<Void> voteOnTrack(
            @PathVariable UUID id,
            @PathVariable UUID trackId,
            @RequestBody DanceTrackVoteRequest request) {
        int voteValue = "up".equals(request.vote()) ? 1 : "down".equals(request.vote()) ? -1 : 0;
        if (voteValue == 0) return ResponseEntity.badRequest().build();
        try {
            danceService.voteOnTrack(id, trackId, voteValue);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}/tracks/{trackId}/vote")
    @Operation(summary = "Remove a vote on a recommended track")
    public ResponseEntity<Void> removeVote(
            @PathVariable UUID id,
            @PathVariable UUID trackId) {
        try {
            danceService.removeVote(id, trackId);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/primary-track")
    @Operation(summary = "Get the current user's primary track for a dance")
    public ResponseEntity<TrackListDto> getPrimaryTrack(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId) {
        if (userId == null) return ResponseEntity.notFound().build();
        return dancePrimaryTrackService.get(userId, id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/primary-track")
    @Operation(summary = "Set the current user's primary track for a dance")
    public ResponseEntity<Void> setPrimaryTrack(
            @PathVariable UUID id,
            @RequestBody SetPrimaryTrackRequest request,
            @AuthenticationPrincipal UUID userId) {
        if (userId == null) return ResponseEntity.status(401).build();
        dancePrimaryTrackService.set(userId, id, request.trackId());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}/primary-track")
    @Operation(summary = "Clear the current user's primary track for a dance")
    public ResponseEntity<Void> clearPrimaryTrack(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId) {
        if (userId == null) return ResponseEntity.status(401).build();
        dancePrimaryTrackService.clear(userId, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/tracks/{trackId}")
    @Operation(summary = "Suggest a track for a dance (authenticated users)")
    public ResponseEntity<Map<String, Object>> suggestTrack(
            @PathVariable UUID id,
            @PathVariable UUID trackId,
            @AuthenticationPrincipal UUID userId) {
        DanceTrack link = danceService.suggestTrack(id, trackId, userId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", link.getId());
        result.put("isConfirmed", link.isConfirmed());
        return ResponseEntity.ok(result);
    }
}
