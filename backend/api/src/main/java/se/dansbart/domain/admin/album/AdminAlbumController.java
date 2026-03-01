package se.dansbart.domain.admin.album;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;
import org.springframework.http.MediaType;

@RestController
@RequestMapping(value = "/api/admin/albums", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Admin Albums", description = "Admin album management endpoints")
public class AdminAlbumController {

    private final AdminAlbumService albumService;

    @GetMapping
    @Operation(summary = "Get paginated list of albums")
    public ResponseEntity<Map<String, Object>> getAlbums(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String artistId,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return ResponseEntity.ok(albumService.getAlbumsPaginated(search, artistId, limit, offset));
    }

    @PostMapping("/{albumId}/reject")
    @Operation(summary = "Reject an album and delete pending tracks")
    public ResponseEntity<Map<String, Object>> rejectAlbum(
            @PathVariable UUID albumId,
            @RequestBody(required = false) RejectRequest request) {
        RejectRequest req = request != null ? request : new RejectRequest();
        try {
            return ResponseEntity.ok(albumService.rejectAlbum(albumId, req.reason(), req.dryRun()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    public record RejectRequest(String reason, boolean dryRun) {
        public RejectRequest() {
            this("Not relevant", false);
        }
    }
}
