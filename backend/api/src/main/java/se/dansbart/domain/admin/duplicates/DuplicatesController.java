package se.dansbart.domain.admin.duplicates;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/tracks/duplicates")
@RequiredArgsConstructor
@Tag(name = "Admin Duplicates", description = "Track duplicate management endpoints")
public class DuplicatesController {

    private final DuplicateMergerService mergerService;

    @GetMapping
    @Operation(summary = "Get tracks that share the same ISRC (duplicates)")
    public ResponseEntity<Map<String, Object>> getDuplicates(
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return ResponseEntity.ok(mergerService.getDuplicateTracks(limit, offset));
    }

    @GetMapping("/mergeable")
    @Operation(summary = "Get list of ISRCs with duplicate tracks that can be merged")
    public ResponseEntity<Map<String, Object>> getMergeableDuplicates(
            @RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok(mergerService.findMergeableDuplicates(limit));
    }

    @GetMapping("/analyze/{isrc}")
    @Operation(summary = "Analyze duplicates for a specific ISRC")
    public ResponseEntity<Map<String, Object>> analyzeDuplicates(@PathVariable String isrc) {
        return ResponseEntity.ok(mergerService.getDuplicateAnalysis(isrc));
    }

    @PostMapping("/merge/{isrc}")
    @Operation(summary = "Merge all duplicate tracks with the given ISRC into a single canonical track")
    public ResponseEntity<Map<String, Object>> mergeDuplicates(
            @PathVariable String isrc,
            @RequestParam(defaultValue = "false") boolean dryRun) {
        return ResponseEntity.ok(mergerService.mergeDuplicatesByIsrc(isrc, dryRun));
    }

    @PostMapping("/merge-all")
    @Operation(summary = "Merge ALL duplicate tracks in the database")
    public ResponseEntity<Map<String, Object>> mergeAllDuplicates(
            @RequestParam(defaultValue = "false") boolean dryRun,
            @RequestParam(required = false) Integer limit) {
        return ResponseEntity.ok(mergerService.mergeAllDuplicates(dryRun, limit));
    }
}
