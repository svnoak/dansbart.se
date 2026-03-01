package se.dansbart.domain.playlist;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import se.dansbart.domain.user.PlaylistCollaborator;
import se.dansbart.dto.CollaboratorDto;
import se.dansbart.dto.InvitationDto;
import se.dansbart.dto.PlaylistDto;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.MediaType;

@RestController
@RequestMapping(value = "/api/playlists", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Playlists", description = "User playlist management")
public class PlaylistController {

    private final PlaylistService playlistService;

    @GetMapping
    @Operation(summary = "Get current user's playlists")
    public ResponseEntity<List<Playlist>> getMyPlaylists(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return ResponseEntity.ok(playlistService.findByUserId(userId));
    }

    @GetMapping("/shared")
    @Operation(summary = "Get playlists shared with current user")
    public ResponseEntity<List<Playlist>> getSharedPlaylists(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return ResponseEntity.ok(playlistService.findSharedWithUser(userId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get playlist by ID")
    public ResponseEntity<PlaylistDto> getPlaylist(@PathVariable UUID id) {
        return playlistService.findByIdAsDto(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @Operation(summary = "Create a new playlist")
    public ResponseEntity<Playlist> createPlaylist(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody CreatePlaylistRequest request) {
        String userId = jwt.getSubject();
        Playlist playlist = playlistService.create(userId, request.name(), request.description());
        return ResponseEntity.created(URI.create("/api/playlists/" + playlist.getId())).body(playlist);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a playlist")
    public ResponseEntity<Playlist> updatePlaylist(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody UpdatePlaylistRequest request) {
        String userId = jwt.getSubject();
        return playlistService.update(id, userId, request.name(), request.description(), request.isPublic())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a playlist")
    public ResponseEntity<Void> deletePlaylist(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        if (playlistService.delete(id, userId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/tracks")
    @Operation(summary = "Add a track to playlist")
    public ResponseEntity<PlaylistTrack> addTrack(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody AddTrackRequest request) {
        String userId = jwt.getSubject();
        return playlistService.addTrack(id, userId, request.trackId())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}/tracks/{trackId}")
    @Operation(summary = "Remove a track from playlist")
    public ResponseEntity<Void> removeTrack(
            @PathVariable UUID id,
            @PathVariable UUID trackId,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        if (playlistService.removeTrack(id, userId, trackId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    // ===== Collaboration Endpoints =====

    @GetMapping("/share/{shareToken}")
    @Operation(summary = "Get playlist by share token")
    public ResponseEntity<PlaylistDto> getPlaylistByShareToken(@PathVariable String shareToken) {
        return playlistService.findByShareTokenAsDto(shareToken)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/invitations")
    @Operation(summary = "Get pending playlist invitations for current user")
    public ResponseEntity<List<InvitationDto>> getInvitations(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return ResponseEntity.ok(playlistService.getPendingInvitations(userId));
    }

    @PutMapping("/invitations/{invitationId}")
    @Operation(summary = "Accept or reject a playlist invitation")
    public ResponseEntity<PlaylistCollaborator> respondToInvitation(
            @PathVariable UUID invitationId,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody RespondToInvitationRequest request) {
        String userId = jwt.getSubject();
        return playlistService.respondToInvitation(invitationId, userId, request.accept())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/tracks/reorder")
    @Operation(summary = "Reorder tracks in playlist")
    public ResponseEntity<Void> reorderTracks(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody ReorderTracksRequest request) {
        String userId = jwt.getSubject();
        if (playlistService.reorderTracks(id, userId, request.trackIds())) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/collaborators")
    @Operation(summary = "Invite a collaborator to playlist")
    public ResponseEntity<PlaylistCollaborator> inviteCollaborator(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody InviteCollaboratorRequest request) {
        String userId = jwt.getSubject();
        return playlistService.inviteCollaborator(id, userId, request.userId(), request.permission())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.badRequest().build());
    }

    @GetMapping("/{id}/collaborators")
    @Operation(summary = "Get playlist collaborators")
    public ResponseEntity<List<CollaboratorDto>> getCollaborators(@PathVariable UUID id) {
        return ResponseEntity.ok(playlistService.getCollaborators(id));
    }

    @PutMapping("/{id}/collaborators/{collaboratorId}")
    @Operation(summary = "Update collaborator permission")
    public ResponseEntity<PlaylistCollaborator> updateCollaborator(
            @PathVariable UUID id,
            @PathVariable UUID collaboratorId,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody UpdateCollaboratorRequest request) {
        String userId = jwt.getSubject();
        return playlistService.updateCollaborator(id, userId, collaboratorId, request.permission())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}/collaborators/{collaboratorId}")
    @Operation(summary = "Remove a collaborator from playlist")
    public ResponseEntity<Void> removeCollaborator(
            @PathVariable UUID id,
            @PathVariable UUID collaboratorId,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        if (playlistService.removeCollaborator(id, userId, collaboratorId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/share-token")
    @Operation(summary = "Generate a share token for playlist")
    public ResponseEntity<Playlist> generateShareToken(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return playlistService.generateShareToken(id, userId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    // Request DTOs
    public record CreatePlaylistRequest(String name, String description) {}
    public record UpdatePlaylistRequest(String name, String description, Boolean isPublic) {}
    public record AddTrackRequest(UUID trackId) {}
    public record RespondToInvitationRequest(boolean accept) {}
    public record ReorderTracksRequest(List<UUID> trackIds) {}
    public record InviteCollaboratorRequest(String userId, String permission) {}
    public record UpdateCollaboratorRequest(String permission) {}
}
