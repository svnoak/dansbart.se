package se.dansbart.domain.admin.artist;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import se.dansbart.dto.ArtistDto;
import se.dansbart.dto.request.UpdateArtistDescriptionRequest;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.MediaType;

@RestController
@RequestMapping(value = "/api/admin/artists", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Admin Artists", description = "Admin artist management endpoints")
public class AdminArtistController {

    private final AdminArtistService artistService;

    @GetMapping
    @Operation(summary = "Get paginated list of artists")
    public ResponseEntity<Map<String, Object>> getArtists(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String isolated,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return ResponseEntity.ok(artistService.getArtistsPaginated(search, isolated, limit, offset));
    }

    @GetMapping("/{artistId}/isolation-check")
    @Operation(summary = "Check if an artist is isolated or shares content with other artists")
    public ResponseEntity<Map<String, Object>> getIsolationStatus(@PathVariable UUID artistId) {
        Map<String, Object> result = artistService.getArtistIsolationInfo(artistId);
        if (result.containsKey("error")) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{artistId}/collaboration-network")
    @Operation(summary = "Get detailed collaboration network for an artist")
    public ResponseEntity<Map<String, Object>> getCollaborationNetwork(@PathVariable UUID artistId) {
        try {
            return ResponseEntity.ok(artistService.getCollaborationNetwork(artistId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PatchMapping("/{artistId}")
    @Operation(summary = "Update artist description")
    public ResponseEntity<ArtistDto> updateArtistDescription(
            @PathVariable UUID artistId,
            @RequestBody UpdateArtistDescriptionRequest request) {
        try {
            return ResponseEntity.ok(artistService.updateDescription(artistId, request.getDescription()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{artistId}/reject")
    @Operation(summary = "Reject an artist and delete pending tracks")
    public ResponseEntity<Map<String, Object>> rejectArtist(
            @PathVariable UUID artistId,
            @RequestBody(required = false) RejectRequest request) {
        RejectRequest req = request != null ? request : new RejectRequest();
        try {
            return ResponseEntity.ok(artistService.rejectArtist(
                artistId, req.reason(), req.dryRun(), req.deleteContent()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{artistId}/approve")
    @Operation(summary = "Approve an artist and queue pending tracks for analysis")
    public ResponseEntity<Map<String, Object>> approveArtist(@PathVariable UUID artistId) {
        try {
            return ResponseEntity.ok(artistService.approveArtist(artistId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/bulk-reject")
    @Operation(summary = "Reject multiple artists at once")
    public ResponseEntity<Map<String, Object>> bulkRejectArtists(@RequestBody BulkRejectRequest request) {
        return ResponseEntity.ok(artistService.bulkRejectArtists(
            request.ids(), request.reason(), request.deleteContent()));
    }

    @PostMapping("/bulk-approve")
    @Operation(summary = "Approve multiple artists at once")
    public ResponseEntity<Map<String, Object>> bulkApproveArtists(@RequestBody BulkApproveRequest request) {
        return ResponseEntity.ok(artistService.bulkApproveArtists(request.ids()));
    }

    // Request DTOs
    public record RejectRequest(
        String reason,
        boolean dryRun,
        boolean deleteContent
    ) {
        public RejectRequest() {
            this("Not relevant", false, true);
        }
    }

    public record BulkRejectRequest(
        List<String> ids,
        String reason,
        boolean deleteContent
    ) {
        public BulkRejectRequest {
            if (reason == null) reason = "Bulk rejection";
            if (ids == null) ids = List.of();
        }
    }

    public record BulkApproveRequest(List<String> ids) {
        public BulkApproveRequest {
            if (ids == null) ids = List.of();
        }
    }
}
