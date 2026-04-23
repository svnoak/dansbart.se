package se.dansbart.domain.dance;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.dansbart.dto.DanceDto;
import se.dansbart.dto.PageResponse;
import se.dansbart.dto.request.DanceImportItem;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping(value = "/api/admin/dances", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Admin Dances", description = "Admin endpoints for managing the dance directory")
public class AdminDanceController {

    private final DanceService danceService;

    @PostMapping("/import")
    @Operation(summary = "Import dances from JSON (upsert by slug), auto-links matching tracks")
    public ResponseEntity<Map<String, Integer>> importDances(
            @RequestBody List<DanceImportItem> items) {
        return ResponseEntity.ok(danceService.importDances(items));
    }

    @PostMapping("/{danceId}/tracks/{trackId}")
    @Operation(summary = "Add a track to a dance directly as confirmed (admin shortcut)")
    public ResponseEntity<Void> addTrack(
            @PathVariable UUID danceId,
            @PathVariable UUID trackId,
            @AuthenticationPrincipal UUID adminId) {
        danceService.addTrackConfirmed(danceId, trackId, adminId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/invalid-styles")
    @Operation(summary = "List dances whose danstyp is not found in dance_style_config")
    public ResponseEntity<PageResponse<DanceDto>> getInvalidStyles(
            @RequestParam(defaultValue = "50") Integer limit,
            @RequestParam(defaultValue = "0") Integer offset) {
        var pageable = PageRequest.of(offset / limit, limit);
        return ResponseEntity.ok(PageResponse.from(danceService.getDancesWithInvalidStyle(pageable)));
    }

    @GetMapping("/pending")
    @Operation(summary = "List unconfirmed track suggestions")
    public ResponseEntity<PageResponse<DanceTrack>> getPendingLinks(
            @RequestParam(defaultValue = "50") Integer limit,
            @RequestParam(defaultValue = "0") Integer offset) {
        var pageable = PageRequest.of(offset / limit, limit);
        Page<DanceTrack> page = danceService.getPendingLinks(pageable);
        return ResponseEntity.ok(PageResponse.from(page));
    }

    @PostMapping("/track-links/{linkId}/confirm")
    @Operation(summary = "Confirm a track-dance suggestion")
    public ResponseEntity<Void> confirmLink(
            @PathVariable UUID linkId,
            @AuthenticationPrincipal UUID adminId) {
        danceService.confirmTrack(linkId, adminId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a dance's fields")
    public ResponseEntity<DanceDto> updateDance(
            @PathVariable UUID id,
            @RequestBody DanceImportItem item) {
        return danceService.updateDance(id, item)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a dance and all its track links")
    public ResponseEntity<Void> deleteDance(@PathVariable UUID id) {
        boolean deleted = danceService.deleteDance(id);
        return deleted ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{danceId}/tracks/{trackId}")
    @Operation(summary = "Remove a track-dance link (confirmed or pending)")
    public ResponseEntity<Void> removeTrack(
            @PathVariable UUID danceId,
            @PathVariable UUID trackId) {
        danceService.removeTrack(danceId, trackId);
        return ResponseEntity.noContent().build();
    }
}
