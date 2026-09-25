package se.dansbart.domain.playlist;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.dansbart.domain.user.PlaylistCollaborator;
import se.dansbart.dto.CollaboratorDto;
import se.dansbart.dto.EditablePlaylistDto;
import se.dansbart.dto.InvitationDto;
import se.dansbart.dto.PlaylistDto;
import se.dansbart.dto.PlaylistListItemDto;

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
    public ResponseEntity<List<PlaylistListItemDto>> getMyPlaylists(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(playlistService.findOwnedAndGroupPlaylists(userId));
    }

    @GetMapping("/shared")
    @Operation(summary = "Get playlists shared with current user")
    public ResponseEntity<List<Playlist>> getSharedPlaylists(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(playlistService.findSharedWithUser(userId));
    }

    @GetMapping("/editable")
    @Operation(operationId = "getEditablePlaylists", summary = "Get playlists the current user can add tracks to")
    public ResponseEntity<List<EditablePlaylistDto>> getEditablePlaylists(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(playlistService.findEditableByUserId(userId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get playlist by ID")
    public ResponseEntity<PlaylistDto> getPlaylist(@PathVariable UUID id, @AuthenticationPrincipal UUID userId) {
        return playlistService.findByIdAsDto(id, userId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @Operation(summary = "Create a new playlist")
    public ResponseEntity<Playlist> createPlaylist(
            @AuthenticationPrincipal UUID userId,
            @RequestBody CreatePlaylistRequest request) {
        Playlist playlist = playlistService.create(userId, request.name(), request.description());
        return ResponseEntity.created(URI.create("/api/playlists/" + playlist.getId())).body(playlist);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a playlist")
    public ResponseEntity<Playlist> updatePlaylist(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId,
            @RequestBody UpdatePlaylistRequest request) {
        return playlistService.update(id, userId, request.name(), request.description(), request.isPublic(), request.danceStyle(), request.subStyle(), request.tempoCategory())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a playlist")
    public ResponseEntity<Void> deletePlaylist(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId) {
        if (playlistService.delete(id, userId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/tracks")
    @Operation(summary = "Add a track to playlist")
    public ResponseEntity<PlaylistTrack> addTrack(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId,
            @RequestBody AddTrackRequest request) {
        return playlistService.addTrack(id, userId, request.trackId())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}/tracks/{trackId}")
    @Operation(summary = "Remove a track from playlist")
    public ResponseEntity<Void> removeTrack(
            @PathVariable UUID id,
            @PathVariable UUID trackId,
            @AuthenticationPrincipal UUID userId) {
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
    public ResponseEntity<List<InvitationDto>> getInvitations(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(playlistService.getPendingInvitations(userId));
    }

    @PutMapping("/invitations/{invitationId}")
    @Operation(summary = "Accept or reject a playlist invitation")
    public ResponseEntity<PlaylistCollaborator> respondToInvitation(
            @PathVariable UUID invitationId,
            @AuthenticationPrincipal UUID userId,
            @RequestBody RespondToInvitationRequest request) {
        return playlistService.respondToInvitation(invitationId, userId, request.accept())
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping("/{id}/tracks/reorder")
    @Operation(summary = "Reorder tracks in playlist")
    public ResponseEntity<Void> reorderTracks(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId,
            @RequestBody ReorderTracksRequest request) {
        if (playlistService.reorderTracks(id, userId, request.trackIds())) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/collaborators")
    @Operation(summary = "Invite a collaborator to playlist")
    public ResponseEntity<?> inviteCollaborator(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId,
            @RequestBody InviteCollaboratorRequest request) {
        return playlistService.inviteCollaborator(id, userId, request.username(), request.permission())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.status(409).build());
    }

    @GetMapping("/{id}/collaborators")
    @Operation(summary = "Get playlist collaborators")
    public ResponseEntity<List<CollaboratorDto>> getCollaborators(@PathVariable UUID id, @AuthenticationPrincipal UUID userId) {
        return playlistService.getCollaborators(id, userId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/collaborators/{collaboratorId}")
    @Operation(summary = "Update collaborator permission")
    public ResponseEntity<PlaylistCollaborator> updateCollaborator(
            @PathVariable UUID id,
            @PathVariable UUID collaboratorId,
            @AuthenticationPrincipal UUID userId,
            @RequestBody UpdateCollaboratorRequest request) {
        return playlistService.updateCollaborator(id, userId, collaboratorId, request.permission())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}/collaborators/{collaboratorId}")
    @Operation(summary = "Remove a collaborator from playlist")
    public ResponseEntity<Void> removeCollaborator(
            @PathVariable UUID id,
            @PathVariable UUID collaboratorId,
            @AuthenticationPrincipal UUID userId) {
        if (playlistService.removeCollaborator(id, userId, collaboratorId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/share-token")
    @Operation(summary = "Generate a share token for playlist")
    public ResponseEntity<Playlist> generateShareToken(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId) {
        return playlistService.generateShareToken(id, userId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}/share-token")
    @Operation(summary = "Invalidate the share token for playlist")
    public ResponseEntity<Void> invalidateShareToken(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId) {
        if (playlistService.invalidateShareToken(id, userId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}/transfer-ownership")
    @Operation(summary = "Transfer playlist ownership to another user")
    public ResponseEntity<Playlist> transferOwnership(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId,
            @RequestBody TransferOwnershipRequest request) {
        return playlistService.transferOwnership(id, userId, request.newOwnerId())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    // Request DTOs
    public record CreatePlaylistRequest(String name, String description) {}
    public record UpdatePlaylistRequest(String name, String description, Boolean isPublic, String danceStyle, String subStyle, String tempoCategory) {}
    public record AddTrackRequest(UUID trackId) {}
    public record RespondToInvitationRequest(boolean accept) {}
    public record ReorderTracksRequest(List<UUID> trackIds) {}
    public record InviteCollaboratorRequest(String username, String permission) {}
    public record UpdateCollaboratorRequest(String permission) {}
    public record TransferOwnershipRequest(UUID newOwnerId) {}
}
