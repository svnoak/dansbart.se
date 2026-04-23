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

    @GetMapping
    @Operation(summary = "List dances with optional search and pagination")
    public ResponseEntity<PageResponse<DanceDto>> getDances(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "20") Integer limit,
            @RequestParam(defaultValue = "0") Integer offset) {
        var pageable = PageRequest.of(offset / limit, limit);
        return ResponseEntity.ok(PageResponse.from(danceService.getDances(search, pageable)));
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
