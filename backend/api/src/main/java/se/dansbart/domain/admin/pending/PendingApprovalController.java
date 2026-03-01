package se.dansbart.domain.admin.pending;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import se.dansbart.domain.admin.album.AdminAlbumService;

import java.util.Map;
import java.util.UUID;
import org.springframework.http.MediaType;

@RestController
@RequestMapping(value = "/api/admin", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Admin Pending", description = "Pending artist and album approval endpoints")
public class PendingApprovalController {

    private final PendingApprovalService pendingService;
    private final AdminAlbumService albumService;

    @GetMapping("/pending-artists")
    @Operation(summary = "Get artists pending manual approval")
    public ResponseEntity<Map<String, Object>> getPendingArtistsForApproval(
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return ResponseEntity.ok(pendingService.getPendingArtistsForApproval(limit, offset));
    }

    @PostMapping("/pending-artists/{id}/approve")
    @Operation(summary = "Approve a pending artist and ingest their discography")
    public ResponseEntity<Map<String, Object>> approvePendingArtist(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(pendingService.approvePendingArtist(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/pending-artists/{id}/reject")
    @Operation(summary = "Reject a pending artist and add to blocklist")
    public ResponseEntity<Map<String, Object>> rejectPendingArtist(
            @PathVariable UUID id,
            @RequestBody(required = false) RejectRequest request) {
        String reason = request != null && request.reason() != null ? request.reason() : "Not relevant";
        try {
            return ResponseEntity.ok(pendingService.rejectPendingArtist(id, reason));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/pending/artists")
    @Operation(summary = "Get artists with pending tracks")
    public ResponseEntity<Map<String, Object>> getPendingArtists(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return ResponseEntity.ok(pendingService.getPendingArtists(search, limit, offset));
    }

    @GetMapping("/pending/albums")
    @Operation(summary = "Get albums with pending tracks")
    public ResponseEntity<Map<String, Object>> getPendingAlbums(
            @RequestParam(required = false) String artistId,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return ResponseEntity.ok(albumService.getPendingAlbums(artistId, limit, offset));
    }

    public record RejectRequest(String reason) {}
}
