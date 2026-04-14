package se.dansbart.domain.admin.folkwiki;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping(value = "/api/admin/folkwiki", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Admin Folkwiki", description = "Folkwiki tune matching review and confirmation")
public class AdminFolkwikiController {

    private final AdminFolkwikiService folkwikiService;
    private final ObjectMapper objectMapper;

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload folkwiki_tunes.json, import tunes and run matching")
    public ResponseEntity<Map<String, Object>> importTunes(@RequestParam("file") MultipartFile file) {
        try {
            List<FolkwikiTuneImport> tunes = objectMapper.readValue(
                file.getInputStream(),
                new TypeReference<>() {}
            );
            return ResponseEntity.ok(folkwikiService.importTunesAndMatch(tunes));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/matches")
    @Operation(summary = "Get folkwiki matches with optional status filter")
    public ResponseEntity<Map<String, Object>> getMatches(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return ResponseEntity.ok(folkwikiService.getMatches(status, limit, offset));
    }

    @GetMapping("/matches/counts")
    @Operation(summary = "Get match counts by status")
    public ResponseEntity<Map<String, Integer>> getStatusCounts() {
        return ResponseEntity.ok(folkwikiService.getStatusCounts());
    }

    @PostMapping("/backfill-bars")
    @Operation(summary = "Dispatch bar correction tasks for all folkwiki-confirmed tracks")
    public ResponseEntity<Map<String, Object>> backfillBars() {
        return ResponseEntity.ok(folkwikiService.backfillBars());
    }

    @PutMapping("/tunes/{folkwikiTuneId}/style")
    @Operation(summary = "Correct the style string stored on a folkwiki tune")
    public ResponseEntity<Map<String, Object>> correctTuneStyle(
            @PathVariable int folkwikiTuneId,
            @RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(folkwikiService.correctTuneStyle(folkwikiTuneId, body.get("style")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/matches/{trackId}/{folkwikiTuneId}/confirm")
    @Operation(summary = "Confirm a match and apply folkwiki style to track")
    public ResponseEntity<Map<String, Object>> confirmMatch(
            @PathVariable UUID trackId,
            @PathVariable int folkwikiTuneId,
            @RequestParam(defaultValue = "false") boolean force) {
        try {
            return ResponseEntity.ok(folkwikiService.confirmMatch(trackId, folkwikiTuneId, force));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/matches/{trackId}/{folkwikiTuneId}/reject")
    @Operation(summary = "Reject a match, optionally overriding the track style")
    public ResponseEntity<Map<String, Object>> rejectMatch(
            @PathVariable UUID trackId,
            @PathVariable int folkwikiTuneId,
            @RequestParam(required = false) String overrideStyle) {
        try {
            return ResponseEntity.ok(folkwikiService.rejectMatch(trackId, folkwikiTuneId, overrideStyle));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
