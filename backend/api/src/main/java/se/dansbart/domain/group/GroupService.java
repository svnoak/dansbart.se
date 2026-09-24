package se.dansbart.domain.group;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.playlist.PlaylistJooqRepository;
import se.dansbart.domain.playlist.PlaylistService;
import se.dansbart.domain.user.User;
import se.dansbart.domain.user.UserJooqRepository;
import se.dansbart.dto.GroupDto;
import se.dansbart.dto.GroupInvitationDto;
import se.dansbart.dto.GroupMemberDto;
import se.dansbart.dto.GroupSummaryDto;
import se.dansbart.dto.PlaylistDto;
import se.dansbart.dto.PlaylistSummaryDto;
import se.dansbart.exception.BadRequestException;
import se.dansbart.exception.ConflictException;
import se.dansbart.exception.ForbiddenException;
import se.dansbart.exception.ResourceNotFoundException;
import se.dansbart.exception.UnprocessableEntityException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupJooqRepository groupJooqRepository;
    private final GroupMemberJooqRepository groupMemberJooqRepository;
    private final UserJooqRepository userJooqRepository;
    private final PlaylistJooqRepository playlistJooqRepository;
    private final PlaylistService playlistService;

    @Transactional
    public GroupDto create(UUID creatorId, String name, String aboutUs, Boolean isPublic) {
        String trimmedName = validateAndTrimName(name);
        if (groupJooqRepository.findByNameIgnoreCase(trimmedName).isPresent()) {
            throw new ConflictException("A group with that name already exists.");
        }
        Group group = Group.builder()
            .name(trimmedName)
            .aboutUs(aboutUs)
            .isPublic(isPublic != null && isPublic)
            .build();
        try {
            group = groupJooqRepository.insert(group);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("A group with that name already exists.");
        }

        GroupMember creator = GroupMember.builder()
            .groupId(group.getId())
            .userId(creatorId)
            .isAdmin(true)
            .canEditInfo(true)
            .canManagePlaylists(true)
            .canInviteMembers(true)
            .canRemoveMembers(true)
            .status("accepted")
            .invitedBy(creatorId)
            .acceptedAt(OffsetDateTime.now())
            .build();
        groupMemberJooqRepository.save(creator);

        return toGroupDto(group, true, true, Optional.of(creator));
    }

    @Transactional
    public PlaylistDto createPlaylist(UUID groupId, UUID creatorId, String name, String description) {
        Group group = loadVisibleGroup(groupId, creatorId);
        if (!memberOf(groupId, creatorId).map(GroupMember::canManagePlaylists).orElse(false)) {
            throw new ForbiddenException("You do not have permission to create playlists for this group.");
        }
        String trimmedName = validateAndTrimName(name);
        return playlistService.createForGroup(group.getId(), creatorId, trimmedName, description);
    }

    @Transactional(readOnly = true)
    public Optional<GroupDto> findByIdAsDto(UUID groupId, UUID viewerId) {
        Optional<Group> group = groupJooqRepository.findById(groupId);
        if (group.isEmpty()) {
            return Optional.empty();
        }
        Optional<GroupMember> viewerMembership = memberOf(groupId, viewerId);
        if (!canView(group.get(), viewerMembership)) {
            return Optional.empty();
        }
        boolean includeMembers = viewerMembership.isPresent();
        boolean includePending = viewerMembership.map(GroupMember::canInviteMembers).orElse(false);
        return Optional.of(toGroupDto(group.get(), includeMembers, includePending, viewerMembership));
    }

    @Transactional(readOnly = true)
    public List<GroupSummaryDto> findMyGroups(UUID userId) {
        return groupJooqRepository.findByMemberUserId(userId).stream()
            .map(this::toSummaryDto)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GroupSummaryDto> findPublicGroups() {
        return groupJooqRepository.findPublicGroups().stream()
            .map(this::toSummaryDto)
            .collect(Collectors.toList());
    }

    @Transactional
    public GroupDto update(UUID groupId, UUID userId, String name, String aboutUs, Boolean isPublic) {
        Group group = loadVisibleGroup(groupId, userId);
        GroupMember membership = memberOf(groupId, userId).orElse(null);
        if (membership == null || !membership.canEditInfo()) {
            throw new ForbiddenException("You do not have permission to change this group.");
        }
        String trimmedName = name != null ? validateAndTrimName(name) : null;
        if (trimmedName != null) {
            groupJooqRepository.findByNameIgnoreCase(trimmedName)
                .filter(other -> !other.getId().equals(groupId))
                .ifPresent(other -> {
                    throw new ConflictException("A group with that name already exists.");
                });
            group.setName(trimmedName);
        }
        if (aboutUs != null) group.setAboutUs(aboutUs.isEmpty() ? null : aboutUs);
        if (isPublic != null) group.setIsPublic(isPublic);
        Group updated;
        try {
            updated = groupJooqRepository.update(group);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("A group with that name already exists.");
        }
        return toGroupDto(updated, true, membership.canInviteMembers(), Optional.of(membership));
    }

    @Transactional
    public void delete(UUID groupId, UUID userId) {
        loadVisibleGroup(groupId, userId);
        if (!memberOf(groupId, userId).map(GroupMember::getIsAdmin).map(Boolean.TRUE::equals).orElse(false)) {
            throw new ForbiddenException("You do not have permission to delete this group.");
        }
        groupJooqRepository.delete(groupId);
    }

    @Transactional
    public GroupMemberDto inviteMember(UUID groupId, UUID inviterId, String username) {
        loadVisibleGroup(groupId, inviterId);
        if (!memberOf(groupId, inviterId).map(GroupMember::canInviteMembers).orElse(false)) {
            throw new ForbiddenException("You do not have permission to do this in the group.");
        }
        if (username == null || username.isBlank()) {
            throw new BadRequestException("The username is required.");
        }
        UUID inviteeId = userJooqRepository.findByUsernameIgnoreCase(username.trim())
            .map(User::getId)
            .orElseThrow(() -> new UnprocessableEntityException("No user has that username."));
        if (inviteeId.equals(inviterId)) {
            throw new BadRequestException("You cannot invite yourself.");
        }
        if (groupMemberJooqRepository.findByGroupIdAndUserId(groupId, inviteeId).isPresent()) {
            throw new ConflictException("This person is already invited or a member.");
        }
        GroupMember member = GroupMember.builder()
            .groupId(groupId)
            .userId(inviteeId)
            .status("pending")
            .invitedBy(inviterId)
            .build();
        GroupMember saved = groupMemberJooqRepository.save(member);
        return toMemberDto(groupMemberJooqRepository.findByIdWithUser(saved.getId()).orElseThrow());
    }

    @Transactional(readOnly = true)
    public List<GroupInvitationDto> getPendingInvitations(UUID userId) {
        return groupMemberJooqRepository.findPendingInvitationsForUser(userId).stream()
            .map(invitation -> GroupInvitationDto.builder()
                .id(invitation.id())
                .groupId(invitation.groupId())
                .groupName(invitation.groupName())
                .invitedByUserId(invitation.invitedByUserId())
                .invitedByDisplayName(invitation.invitedByDisplayName())
                .invitedAt(invitation.invitedAt())
                .build())
            .collect(Collectors.toList());
    }

    @Transactional
    public Optional<GroupMemberDto> acceptInvitation(UUID invitationId, UUID userId) {
        return findPendingInvitation(invitationId, userId)
            .map(member -> {
                member.setStatus("accepted");
                member.setAcceptedAt(OffsetDateTime.now());
                GroupMember saved = groupMemberJooqRepository.save(member);
                return toMemberDto(groupMemberJooqRepository.findByIdWithUser(saved.getId()).orElseThrow());
            });
    }

    @Transactional
    public boolean declineInvitation(UUID invitationId, UUID userId) {
        Optional<GroupMember> invitation = findPendingInvitation(invitationId, userId);
        invitation.ifPresent(groupMemberJooqRepository::delete);
        return invitation.isPresent();
    }

    /** Refuses to demote the group's last accepted admin. */
    @Transactional
    public GroupMemberDto updateMemberPermissions(UUID groupId, UUID actingUserId, UUID memberId,
            Boolean isAdmin, Boolean canEditInfo, Boolean canManagePlaylists, Boolean canInviteMembers, Boolean canRemoveMembers) {
        loadVisibleGroup(groupId, actingUserId);
        GroupMember member = findMemberInGroup(groupId, memberId);
        boolean actingIsAdmin = memberOf(groupId, actingUserId).map(GroupMember::getIsAdmin).map(Boolean.TRUE::equals).orElse(false);
        if (!actingIsAdmin) {
            throw new ForbiddenException("You do not have permission to do this in the group.");
        }
        if (!member.isAccepted()) {
            throw new ConflictException("This person has not accepted the invitation yet.");
        }

        groupJooqRepository.lockForUpdate(groupId);
        member = findMemberInGroup(groupId, memberId);
        boolean demotingLastAdmin = Boolean.TRUE.equals(member.getIsAdmin()) && Boolean.FALSE.equals(isAdmin)
            && groupMemberJooqRepository.countAcceptedAdmins(groupId) <= 1;
        if (demotingLastAdmin) {
            throw new ConflictException("A group needs at least one admin.");
        }

        if (isAdmin != null) member.setIsAdmin(isAdmin);
        if (canEditInfo != null) member.setCanEditInfo(canEditInfo);
        if (canManagePlaylists != null) member.setCanManagePlaylists(canManagePlaylists);
        if (canInviteMembers != null) member.setCanInviteMembers(canInviteMembers);
        if (canRemoveMembers != null) member.setCanRemoveMembers(canRemoveMembers);
        GroupMember saved = groupMemberJooqRepository.save(member);
        return toMemberDto(groupMemberJooqRepository.findByIdWithUser(saved.getId()).orElseThrow());
    }

    /** Anyone may remove themselves; otherwise the last accepted admin cannot be removed. */
    @Transactional
    public void removeMember(UUID groupId, UUID actingUserId, UUID memberId) {
        loadVisibleGroup(groupId, actingUserId);
        Optional<GroupMember> actingMembership = memberOf(groupId, actingUserId);
        GroupMember target = findMemberInGroup(groupId, memberId);

        boolean isSelf = target.getUserId().equals(actingUserId);
        boolean actingIsAdmin = actingMembership.map(GroupMember::getIsAdmin).map(Boolean.TRUE::equals).orElse(false);
        boolean actingCanRemove = actingMembership.map(GroupMember::canRemoveMembers).orElse(false);
        if (!isSelf && !actingIsAdmin && (!actingCanRemove || Boolean.TRUE.equals(target.getIsAdmin()))) {
            throw new ForbiddenException("You do not have permission to do this in the group.");
        }

        groupJooqRepository.lockForUpdate(groupId);
        target = findMemberInGroup(groupId, memberId);
        boolean isLastAdmin = Boolean.TRUE.equals(target.getIsAdmin()) && target.isAccepted()
            && groupMemberJooqRepository.countAcceptedAdmins(groupId) <= 1;
        if (isLastAdmin) {
            throw new ConflictException("A group needs at least one admin.");
        }
        groupMemberJooqRepository.delete(target);
    }

    private Group loadVisibleGroup(UUID groupId, UUID viewerId) {
        return groupJooqRepository.findById(groupId)
            .filter(g -> canView(g, memberOf(groupId, viewerId)))
            .orElseThrow(() -> new ResourceNotFoundException("The group does not exist, or you do not have access to it."));
    }

    private GroupMember findMemberInGroup(UUID groupId, UUID memberId) {
        return groupMemberJooqRepository.findById(memberId)
            .filter(m -> m.getGroupId().equals(groupId))
            .orElseThrow(() -> new ResourceNotFoundException("This person is not a member of the group."));
    }

    private Optional<GroupMember> findPendingInvitation(UUID invitationId, UUID userId) {
        return groupMemberJooqRepository.findById(invitationId)
            .filter(m -> m.getUserId().equals(userId) && "pending".equals(m.getStatus()));
    }

    private String validateAndTrimName(String name) {
        if (name == null || name.isBlank()) {
            throw new BadRequestException("A group needs a name.");
        }
        return name.trim();
    }

    private Optional<GroupMember> memberOf(UUID groupId, UUID userId) {
        return groupMemberJooqRepository.findByGroupIdAndUserId(groupId, userId)
            .filter(GroupMember::isAccepted);
    }

    private boolean canView(Group group, Optional<GroupMember> viewerMembership) {
        return Boolean.TRUE.equals(group.getIsPublic()) || viewerMembership.isPresent();
    }

    private GroupSummaryDto toSummaryDto(Group group) {
        return GroupSummaryDto.builder()
            .id(group.getId())
            .name(group.getName())
            .isPublic(group.getIsPublic())
            .build();
    }

    private GroupMemberDto toMemberDto(GroupMember member) {
        User user = member.getUser();
        return GroupMemberDto.builder()
            .id(member.getId())
            .userId(member.getUserId())
            .username(user != null ? user.getUsername() : null)
            .displayName(user != null ? user.getDisplayName() : null)
            .avatarUrl(user != null ? user.getAvatarUrl() : null)
            .isAdmin(member.getIsAdmin())
            .canEditInfo(member.getCanEditInfo())
            .canManagePlaylists(member.getCanManagePlaylists())
            .canInviteMembers(member.getCanInviteMembers())
            .canRemoveMembers(member.getCanRemoveMembers())
            .status(member.getStatus())
            .invitedAt(member.getInvitedAt())
            .acceptedAt(member.getAcceptedAt())
            .build();
    }

    private GroupDto toGroupDto(Group group, boolean includeMembers, boolean includePending, Optional<GroupMember> viewerMembership) {
        List<GroupMemberDto> members = includeMembers
            ? groupMemberJooqRepository.findByGroupId(group.getId()).stream()
                .filter(m -> includePending || m.isAccepted())
                .map(this::toMemberDto)
                .collect(Collectors.toList())
            : null;
        List<PlaylistSummaryDto> playlists = playlistJooqRepository.findByGroupIdWithTrackCount(group.getId(), includeMembers).stream()
            .map(pwc -> PlaylistSummaryDto.builder()
                .id(pwc.playlist().getId())
                .name(pwc.playlist().getName())
                .description(pwc.playlist().getDescription())
                .isPublic(pwc.playlist().getIsPublic())
                .trackCount(pwc.trackCount())
                .build())
            .collect(Collectors.toList());
        boolean canOpenSettings = viewerMembership
            .map(m -> m.canEditInfo() || m.canInviteMembers() || m.canRemoveMembers())
            .orElse(false);
        Integer memberCount = null;
        if (canOpenSettings) {
            memberCount = (int) members.stream().filter(m -> "accepted".equals(m.getStatus())).count();
        }
        return GroupDto.builder()
            .id(group.getId())
            .name(group.getName())
            .aboutUs(group.getAboutUs())
            .isPublic(group.getIsPublic())
            .createdAt(group.getCreatedAt())
            .updatedAt(group.getUpdatedAt())
            .members(members)
            .playlists(playlists)
            .memberCount(memberCount)
            .build();
    }
}
