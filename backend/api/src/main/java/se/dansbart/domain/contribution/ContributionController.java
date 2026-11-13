package se.dansbart.domain.contribution;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import se.dansbart.dto.ContributedStyleDto;
import se.dansbart.dto.LinkPreviewDto;
import se.dansbart.dto.TrackSubmissionResultDto;
import se.dansbart.dto.request.DanceStyleCreateRequest;
import se.dansbart.dto.request.TrackSubmissionRequest;

/**
 * Signed-in users add tracks and dance styles to the public library.
 * Not under /api/tracks, whose POST routes are open to anonymous voters.
 */
@RestController
@RequestMapping(value = "/api/contributions", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Contributions", description = "Add tracks and dance styles to the public library (signed-in users)")
public class ContributionController {

    private final ContributionService contributionService;

    @GetMapping("/link-preview")
    @Operation(operationId = "previewContributionLink",
        summary = "Look up the title and artist behind a YouTube or Spotify link")
    public ResponseEntity<LinkPreviewDto> previewLink(@RequestParam String url) {
        return ResponseEntity.ok(contributionService.previewLink(url));
    }

    @PostMapping("/tracks")
    @Operation(operationId = "submitTrack", summary = "Add a track to the public library from a YouTube or Spotify link")
    public ResponseEntity<TrackSubmissionResultDto> submitTrack(@RequestBody TrackSubmissionRequest request) {
        return ResponseEntity.ok(contributionService.submitTrack(request));
    }

    @PostMapping("/styles")
    @Operation(operationId = "createDanceStyle", summary = "Add a dance style, as a main style or a sub-style")
    public ResponseEntity<ContributedStyleDto> createStyle(@RequestBody DanceStyleCreateRequest request) {
        return ResponseEntity.ok(contributionService.createStyle(request));
    }
}
