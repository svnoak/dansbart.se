package se.dansbart.domain.admin.rejection;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import se.dansbart.domain.admin.artist.AdminArtistService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "Admin Rejections", description = "Rejection and blocklist management endpoints")
public class AdminRejectionController {

    private final AdminRejectionService rejectionService;
    private final AdminArtistService artistService;

    @GetMapping("/rejections")
    @Operation(summary = "Get the rejection blocklist")
    public ResponseEntity<Map<String, Object>> getRejections(
            @RequestParam(required = false) String entityType,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return ResponseEntity.ok(rejectionService.getRejectionsPaginated(entityType, limit, offset));
    }

    @DeleteMapping("/rejections/{rejectionId}")
    @Operation(summary = "Remove an item from the blocklist")
    public ResponseEntity<Map<String, Object>> removeFromBlocklist(@PathVariable UUID rejectionId) {
        try {
            String entityName = rejectionService.removeFromBlocklist(rejectionId);
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "'" + entityName + "' removed from blocklist"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/blocklist/add")
    @Operation(summary = "Add a Spotify ID to the blocklist")
    public ResponseEntity<Map<String, Object>> addToBlocklist(@RequestBody BlockSpotifyRequest request) {
        if (rejectionService.checkIfBlocked(request.spotifyId(), "artist")) {
            return ResponseEntity.ok(Map.of("message", "Already blocked"));
        }

        rejectionService.addToBlocklist("artist", request.spotifyId(), request.artistName(), request.reason());
        return ResponseEntity.ok(Map.of(
            "status", "success",
            "message", "Added " + request.artistName() + " to blocklist"
        ));
    }

    @PostMapping("/reject-network")
    @Operation(summary = "Reject a network of artists and albums together")
    public ResponseEntity<Map<String, Object>> rejectNetwork(@RequestBody RejectNetworkRequest request) {
        return ResponseEntity.ok(artistService.rejectNetwork(
            request.artistIds(),
            request.albumIds(),
            request.reason()
        ));
    }

    public record BlockSpotifyRequest(
        String spotifyId,
        String artistName,
        String reason
    ) {
        public BlockSpotifyRequest {
            if (reason == null) reason = "Blocked from spider";
        }
    }

    public record RejectNetworkRequest(
        List<String> artistIds,
        List<String> albumIds,
        String reason
    ) {
        public RejectNetworkRequest {
            if (artistIds == null) artistIds = List.of();
            if (albumIds == null) albumIds = List.of();
            if (reason == null) reason = "Network rejection";
        }
    }
}
