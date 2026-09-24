package se.dansbart.domain.group;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import se.dansbart.dto.GroupDto;
import se.dansbart.dto.GroupInvitationDto;
import se.dansbart.dto.GroupMemberDto;
import se.dansbart.dto.GroupSummaryDto;
import se.dansbart.dto.PlaylistDto;
import se.dansbart.exception.BadRequestException;

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
    public ResponseEntity<GroupDto> createGroup(
            @AuthenticationPrincipal UUID userId,
            @RequestBody CreateGroupRequest request) {
        GroupDto group = groupService.create(userId, request.name(), request.aboutUs(), request.isPublic());
        return ResponseEntity.created(URI.create("/api/groups/" + group.getId())).body(group);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a group's name, about-us text or visibility")
    public ResponseEntity<GroupDto> updateGroup(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId,
            @RequestBody UpdateGroupRequest request) {
        return ResponseEntity.ok(groupService.update(id, userId, request.name(), request.aboutUs(), request.isPublic()));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a group")
    public ResponseEntity<Void> deleteGroup(@PathVariable UUID id, @AuthenticationPrincipal UUID userId) {
        groupService.delete(id, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/members")
    @Operation(summary = "Invite a user to the group")
    public ResponseEntity<GroupMemberDto> inviteMember(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId,
            @RequestBody InviteMemberRequest request) {
        return ResponseEntity.ok(groupService.inviteMember(id, userId, request.username()));
    }

    @PostMapping("/{id}/playlists")
    @Operation(operationId = "createGroupPlaylist", summary = "Create a playlist owned by the group")
    public ResponseEntity<PlaylistDto> createGroupPlaylist(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId,
            @RequestBody CreateGroupPlaylistRequest request) {
        PlaylistDto playlist = groupService.createPlaylist(id, userId, request.name(), request.description());
        return ResponseEntity.created(URI.create("/api/playlists/" + playlist.getId())).body(playlist);
    }

    @GetMapping("/invitations")
    @Operation(operationId = "getGroupInvitations", summary = "Get pending group invitations for current user")
    public ResponseEntity<List<GroupInvitationDto>> getInvitations(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(groupService.getPendingInvitations(userId));
    }

    @PutMapping("/invitations/{invitationId}")
    @Operation(operationId = "respondToGroupInvitation", summary = "Accept or reject a group invitation")
    public ResponseEntity<GroupMemberDto> respondToInvitation(
            @PathVariable UUID invitationId,
            @AuthenticationPrincipal UUID userId,
            @RequestBody RespondToInvitationRequest request) {
        if (request.accept() == null) {
            throw new BadRequestException("Say whether you accept the invitation.");
        }
        if (request.accept()) {
            return groupService.acceptInvitation(invitationId, userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
        }
        if (groupService.declineInvitation(invitationId, userId)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}/members/{memberId}")
    @Operation(summary = "Update a member's permissions or admin status (admin only)")
    public ResponseEntity<GroupMemberDto> updateMember(
            @PathVariable UUID id,
            @PathVariable UUID memberId,
            @AuthenticationPrincipal UUID userId,
            @RequestBody UpdateMemberRequest request) {
        return ResponseEntity.ok(groupService.updateMemberPermissions(id, userId, memberId,
                request.isAdmin(), request.canEditInfo(), request.canManagePlaylists(),
                request.canInviteMembers(), request.canRemoveMembers()));
    }

    @DeleteMapping("/{id}/members/{memberId}")
    @Operation(summary = "Remove a member from the group (or leave it yourself)")
    public ResponseEntity<Void> removeMember(
            @PathVariable UUID id,
            @PathVariable UUID memberId,
            @AuthenticationPrincipal UUID userId) {
        groupService.removeMember(id, userId, memberId);
        return ResponseEntity.noContent().build();
    }

    public record CreateGroupRequest(String name, String aboutUs, Boolean isPublic) {}
    public record CreateGroupPlaylistRequest(String name, String description) {}
    public record UpdateGroupRequest(String name, String aboutUs, Boolean isPublic) {}
    public record InviteMemberRequest(String username) {}
    public record RespondToInvitationRequest(Boolean accept) {}
    public record UpdateMemberRequest(Boolean isAdmin, Boolean canEditInfo, Boolean canManagePlaylists, Boolean canInviteMembers, Boolean canRemoveMembers) {}
}
