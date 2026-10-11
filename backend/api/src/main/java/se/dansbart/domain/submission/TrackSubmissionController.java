package se.dansbart.domain.submission;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import se.dansbart.dto.TrackSubmissionBatchDto;
import se.dansbart.dto.request.SubmitMusicLinkRequest;

import java.util.UUID;

/**
 * "Lägg till musik": anyone may paste a Spotify or YouTube link. Anonymous people send
 * X-Voter-ID like they do for votes; see SecurityConfig for the permitAll rule.
 */
@RestController
@RequestMapping(value = "/api/submissions", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Track Submissions", description = "Add tracks from a Spotify or YouTube link")
public class TrackSubmissionController {

    private final TrackSubmissionService service;

    @PostMapping
    @Operation(operationId = "submitMusicLink",
        summary = "Add the tracks behind a Spotify or YouTube link",
        description = "Returns one row per track. Trusted contributors' tracks go straight to analysis; "
            + "the rest wait for an admin. 400 for a link that is not recognised, 404 when the provider "
            + "has nothing behind it, 422 when YouTube playlists or channels are not available on this server.")
    public ResponseEntity<TrackSubmissionBatchDto> submit(@Valid @RequestBody SubmitMusicLinkRequest request) {
        return ResponseEntity.ok(service.submit(request.url()));
    }

    @GetMapping("/batch/{batchId}")
    @Operation(operationId = "getSubmissionBatch", summary = "The tracks one link produced, with their current status")
    public ResponseEntity<TrackSubmissionBatchDto> getBatch(@PathVariable UUID batchId) {
        return ResponseEntity.ok(service.getBatch(batchId));
    }
}
