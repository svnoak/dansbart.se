package se.dansbart.domain.group;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.dansbart.domain.playlist.Playlist;
import se.dansbart.dto.GroupDto;
import se.dansbart.dto.GroupInvitationDto;
import se.dansbart.dto.GroupMemberDto;
import se.dansbart.dto.GroupSummaryDto;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping(value = "/api/groups", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Groups", description = "User groups that can jointly own playlists")
public class GroupController {

    private final GroupService groupService;

    @GetMapping
    @Operation(summary = "Get groups the current user belongs to")
    public ResponseEntity<List<GroupSummaryDto>> getMyGroups(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(groupService.findMyGroups(userId));
    }

    @GetMapping("/public")
    @Operation(summary = "Get public groups")
    public ResponseEntity<List<GroupSummaryDto>> getPublicGroups() {
        return ResponseEntity.ok(groupService.findPublicGroups());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get group by ID")
    public ResponseEntity<GroupDto> getGroup(@PathVariable UUID id, @AuthenticationPrincipal UUID userId) {
        return groupService.findByIdAsDto(id, userId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @Operation(summary = "Create a new group")
    public ResponseEntity<Group> createGroup(
            @AuthenticationPrincipal UUID userId,
            @RequestBody CreateGroupRequest request) {
        Group group = groupService.create(userId, request.name(), request.aboutUs(), request.isPublic());
        return ResponseEntity.created(URI.create("/api/groups/" + group.getId())).body(group);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a group's name, about-us text or visibility")
    public ResponseEntity<Group> updateGroup(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId,
            @RequestBody UpdateGroupRequest request) {
        return groupService.update(id, userId, request.name(), request.aboutUs(), request.isPublic())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a group")
    public ResponseEntity<Void> deleteGroup(@PathVariable UUID id, @AuthenticationPrincipal UUID userId) {
        if (groupService.delete(id, userId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    // ===== Membership =====

    @GetMapping("/{id}/members")
    @Operation(summary = "Get group members")
    public ResponseEntity<List<GroupMemberDto>> getMembers(@PathVariable UUID id, @AuthenticationPrincipal UUID userId) {
        return groupService.getMembers(id, userId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/members")
    @Operation(summary = "Invite a user to the group")
    public ResponseEntity<GroupMember> inviteMember(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId,
            @RequestBody InviteMemberRequest request) {
        return groupService.inviteMember(id, userId, request.userId())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.badRequest().build());
    }

    @GetMapping("/invitations")
    @Operation(operationId = "getGroupInvitations", summary = "Get pending group invitations for current user")
    public ResponseEntity<List<GroupInvitationDto>> getInvitations(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(groupService.getPendingInvitations(userId));
    }

    @PutMapping("/invitations/{invitationId}")
    @Operation(operationId = "respondToGroupInvitation", summary = "Accept or reject a group invitation")
    public ResponseEntity<GroupMember> respondToInvitation(
            @PathVariable UUID invitationId,
            @AuthenticationPrincipal UUID userId,
            @RequestBody RespondToInvitationRequest request) {
        return groupService.respondToInvitation(invitationId, userId, request.accept())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/members/{memberId}")
    @Operation(summary = "Update a member's permissions or admin status (admin only)")
    public ResponseEntity<GroupMember> updateMember(
            @PathVariable UUID id,
            @PathVariable UUID memberId,
            @AuthenticationPrincipal UUID userId,
            @RequestBody UpdateMemberRequest request) {
        return groupService.updateMemberPermissions(id, userId, memberId,
                request.isAdmin(), request.canEditInfo(), request.canManagePlaylists(),
                request.canInviteMembers(), request.canRemoveMembers())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}/members/{memberId}")
    @Operation(summary = "Remove a member from the group (or leave it yourself)")
    public ResponseEntity<Void> removeMember(
            @PathVariable UUID id,
            @PathVariable UUID memberId,
            @AuthenticationPrincipal UUID userId) {
        if (groupService.removeMember(id, userId, memberId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    // ===== Group playlists =====

    @PostMapping("/{id}/playlists")
    @Operation(operationId = "createGroupPlaylist", summary = "Create a playlist owned by the group")
    public ResponseEntity<Playlist> createPlaylist(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId,
            @RequestBody CreateGroupPlaylistRequest request) {
        return groupService.createPlaylist(id, userId, request.name(), request.description())
            .map(playlist -> ResponseEntity.created(URI.create("/api/playlists/" + playlist.getId())).body(playlist))
            .orElse(ResponseEntity.badRequest().build());
    }

    // Request DTOs
    public record CreateGroupRequest(String name, String aboutUs, Boolean isPublic) {}
    public record UpdateGroupRequest(String name, String aboutUs, Boolean isPublic) {}
    public record InviteMemberRequest(UUID userId) {}
    public record RespondToInvitationRequest(boolean accept) {}
    public record UpdateMemberRequest(Boolean isAdmin, Boolean canEditInfo, Boolean canManagePlaylists, Boolean canInviteMembers, Boolean canRemoveMembers) {}
    public record CreateGroupPlaylistRequest(String name, String description) {}
}
