package se.dansbart.domain.explorer;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.dto.ExplorerTrackDto;
import se.dansbart.dto.PageResponse;

import java.util.List;

@RestController
@RequestMapping(value = "/api/explorer", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Explorer", description = "Public R-pattern explorer endpoints")
public class ExplorerController {

    private final TrackJooqRepository trackRepository;

    @GetMapping("/tracks")
    @Operation(summary = "Fetch tracks for the Explorer scatter plot", operationId = "getExplorerTracks")
    public ResponseEntity<PageResponse<ExplorerTrackDto>> getTracks(
            @Parameter(description = "Meter filter: '3/4' or '4/4' (omit for all)")
            @RequestParam(required = false) String meter,
            @Parameter(description = "Minimum tempo BPM")
            @RequestParam(required = false) Integer minBpm,
            @Parameter(description = "Maximum tempo BPM")
            @RequestParam(required = false) Integer maxBpm,
            @Parameter(description = "Minimum asymmetry score (0.0–0.5)")
            @RequestParam(required = false) Float minAsymmetry,
            @Parameter(description = "Maximum asymmetry score (0.0–0.5)")
            @RequestParam(required = false) Float maxAsymmetry,
            @Parameter(description = "Maximum number of tracks to return")
            @RequestParam(defaultValue = "500") int limit,
            @Parameter(description = "Offset for pagination")
            @RequestParam(defaultValue = "0") int offset) {

        limit = Math.max(1, Math.min(2000, limit));
        offset = Math.max(0, offset);

        List<ExplorerTrackDto> items = trackRepository.findExplorerTracks(
            meter, minBpm, maxBpm, minAsymmetry, maxAsymmetry, limit, offset);
        long total = trackRepository.countExplorerTracks(
            meter, minBpm, maxBpm, minAsymmetry, maxAsymmetry);

        return ResponseEntity.ok(new PageResponse<>(items, total, offset / limit, limit, offset + items.size() < total));
    }
}
