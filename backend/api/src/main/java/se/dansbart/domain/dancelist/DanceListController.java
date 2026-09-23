package se.dansbart.domain.dancelist;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.dansbart.dto.DanceListDto;
import se.dansbart.dto.DanceListEntryDto;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping(value = "/api/dance-lists", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Dance Lists", description = "User dance list management")
public class DanceListController {

    private final DanceListService danceListService;

    @GetMapping
    @Operation(summary = "Get current user's dance lists")
    public ResponseEntity<List<DanceList>> getMyDanceLists(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(danceListService.findByUserId(userId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get dance list by ID")
    public ResponseEntity<DanceListDto> getDanceList(@PathVariable UUID id, @AuthenticationPrincipal UUID userId) {
        return danceListService.findByIdAsDto(id, userId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @Operation(summary = "Create a new dance list")
    public ResponseEntity<DanceList> createDanceList(
            @AuthenticationPrincipal UUID userId,
            @RequestBody CreateDanceListRequest request) {
        DanceList danceList = request.groupId() != null
            ? danceListService.createForGroup(request.groupId(), userId, request.name(), request.description(), request.isPublic())
            : danceListService.create(userId, request.name(), request.description(), request.isPublic());
        return ResponseEntity.created(URI.create("/api/dance-lists/" + danceList.getId())).body(danceList);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a dance list")
    public ResponseEntity<DanceList> updateDanceList(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId,
            @RequestBody UpdateDanceListRequest request) {
        return ResponseEntity.ok(danceListService.update(id, userId, request.name(), request.description(), request.isPublic()));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a dance list")
    public ResponseEntity<Void> deleteDanceList(@PathVariable UUID id, @AuthenticationPrincipal UUID userId) {
        danceListService.delete(id, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/entries")
    @Operation(summary = "Add an entry to a dance list")
    public ResponseEntity<DanceListEntryDto> addEntry(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId,
            @RequestBody AddEntryRequest request) {
        DanceListEntryDto entry = danceListService.addEntry(id, userId, request.danceId(), request.freeTextName());
        return ResponseEntity.status(201).body(entry);
    }

    @DeleteMapping("/{id}/entries/{entryId}")
    @Operation(summary = "Remove an entry from a dance list")
    public ResponseEntity<Void> removeEntry(
            @PathVariable UUID id,
            @PathVariable UUID entryId,
            @AuthenticationPrincipal UUID userId) {
        danceListService.removeEntry(id, userId, entryId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/entries/order")
    @Operation(summary = "Reorder entries in a dance list")
    public ResponseEntity<Void> reorderEntries(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId,
            @RequestBody ReorderEntriesRequest request) {
        danceListService.reorderEntries(id, userId, request.entryIds());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{id}/entries/{entryId}")
    @Operation(summary = "Set the play mode of an entry")
    public ResponseEntity<Void> setPlayMode(
            @PathVariable UUID id,
            @PathVariable UUID entryId,
            @AuthenticationPrincipal UUID userId,
            @RequestBody SetPlayModeRequest request) {
        danceListService.setPlayMode(id, userId, entryId, request.playMode());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/entries/{entryId}/tracks")
    @Operation(summary = "Link a track to an entry")
    public ResponseEntity<DanceListEntryTrack> addTrackToEntry(
            @PathVariable UUID id,
            @PathVariable UUID entryId,
            @AuthenticationPrincipal UUID userId,
            @RequestBody AddTrackRequest request) {
        DanceListEntryTrack link = danceListService.addTrackToEntry(id, userId, entryId, request.trackId());
        return ResponseEntity.status(201).body(link);
    }

    @DeleteMapping("/{id}/entries/{entryId}/tracks/{trackId}")
    @Operation(summary = "Unlink a track from an entry")
    public ResponseEntity<Void> removeTrackFromEntry(
            @PathVariable UUID id,
            @PathVariable UUID entryId,
            @PathVariable UUID trackId,
            @AuthenticationPrincipal UUID userId) {
        danceListService.removeTrackFromEntry(id, userId, entryId, trackId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/entries/{entryId}/tracks/order")
    @Operation(summary = "Reorder tracks in an entry")
    public ResponseEntity<Void> reorderTracksInEntry(
            @PathVariable UUID id,
            @PathVariable UUID entryId,
            @AuthenticationPrincipal UUID userId,
            @RequestBody ReorderTracksRequest request) {
        danceListService.reorderEntryTracks(id, userId, entryId, request.trackIds());
        return ResponseEntity.ok().build();
    }

    public record CreateDanceListRequest(String name, String description, Boolean isPublic, UUID groupId) {}
    public record UpdateDanceListRequest(String name, String description, Boolean isPublic) {}
    public record AddEntryRequest(UUID danceId, String freeTextName) {}
    public record ReorderEntriesRequest(List<UUID> entryIds) {}
    public record SetPlayModeRequest(String playMode) {}
    public record AddTrackRequest(UUID trackId) {}
    public record ReorderTracksRequest(List<UUID> trackIds) {}
}
