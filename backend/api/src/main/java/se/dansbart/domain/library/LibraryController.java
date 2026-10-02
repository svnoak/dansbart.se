package se.dansbart.domain.library;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import org.springframework.http.MediaType;

@RestController
@RequestMapping(value = "/api/library", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Library", description = "User library for personal track sources")
public class LibraryController {

    private final LibraryService libraryService;

    @PostMapping("/tracks")
    @Operation(summary = "Import a track to library")
    public ResponseEntity<LibraryImportResponse> importTrack(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody ImportTrackRequest request) {
        LibraryImportResponse response = libraryService.importTrack(userId, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/tracks")
    @Operation(summary = "List user's track sources")
    public ResponseEntity<List<LibrarySourceDto>> listTracks(@AuthenticationPrincipal UUID userId) {
        List<LibrarySourceDto> sources = libraryService.listUserSources(userId);
        return ResponseEntity.ok(sources);
    }

    @PostMapping("/sources/{sourceId}/match")
    @Operation(summary = "Check whether a file hash matches the track of a source")
    public ResponseEntity<MatchResponse> matchHash(
            @PathVariable UUID sourceId,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody MatchRequest request) {
        return libraryService.matchesHash(sourceId, userId, request.contentHash())
            .map(matches -> ResponseEntity.ok(new MatchResponse(matches)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/sources/{sourceId}")
    @Operation(summary = "Delete a track source")
    public ResponseEntity<Void> deleteSource(
            @PathVariable UUID sourceId,
            @AuthenticationPrincipal UUID userId) {
        if (libraryService.deleteSource(sourceId, userId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
