package se.dansbart.domain.group;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.playlist.Playlist;
import se.dansbart.domain.playlist.PlaylistService;
import se.dansbart.domain.user.User;
import se.dansbart.domain.user.UserJooqRepository;
import se.dansbart.dto.GroupDto;
import se.dansbart.dto.GroupInvitationDto;
import se.dansbart.dto.GroupMemberDto;
import se.dansbart.dto.GroupSummaryDto;
import se.dansbart.dto.PlaylistSummaryDto;

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
    private final PlaylistService playlistService;

    @Transactional
    public Group create(UUID creatorId, String name, String aboutUs, Boolean isPublic) {
        Group group = Group.builder()
            .name(name)
            .aboutUs(aboutUs)
            .isPublic(isPublic != null && isPublic)
            .build();
        group = groupJooqRepository.insert(group);

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

        return group;
    }

    @Transactional(readOnly = true)
    public Optional<Group> findById(UUID id) {
        return groupJooqRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<GroupDto> findByIdAsDto(UUID groupId, UUID viewerId) {
        return groupJooqRepository.findById(groupId)
            .filter(g -> canView(g, viewerId))
            .map(this::toGroupDto);
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
    public Optional<Group> update(UUID groupId, UUID userId, String name, String aboutUs, Boolean isPublic) {
        return groupJooqRepository.findById(groupId)
            .filter(g -> memberOf(groupId, userId).map(GroupMember::canEditInfo).orElse(false))
            .map(group -> {
                if (name != null) group.setName(name);
                if (aboutUs != null) group.setAboutUs(aboutUs.isEmpty() ? null : aboutUs);
                if (isPublic != null) group.setIsPublic(isPublic);
                return groupJooqRepository.update(group);
            });
    }

    @Transactional
    public boolean delete(UUID groupId, UUID userId) {
        return groupJooqRepository.findById(groupId)
            .filter(g -> memberOf(groupId, userId).map(GroupMember::getIsAdmin).map(Boolean.TRUE::equals).orElse(false))
            .map(group -> {
                groupJooqRepository.delete(groupId);
                return true;
            })
            .orElse(false);
    }

    // ===== Membership =====

    @Transactional(readOnly = true)
    public Optional<List<GroupMemberDto>> getMembers(UUID groupId, UUID viewerId) {
        return groupJooqRepository.findById(groupId)
            .filter(g -> canView(g, viewerId))
            .map(g -> groupMemberJooqRepository.findByGroupId(groupId).stream()
                .map(this::toMemberDto)
                .collect(Collectors.toList()));
    }

    @Transactional
    public Optional<GroupMember> inviteMember(UUID groupId, UUID inviterId, UUID inviteeId) {
        if (inviteeId == null || inviteeId.equals(inviterId)) {
            return Optional.empty();
        }
        return groupJooqRepository.findById(groupId)
            .filter(g -> memberOf(groupId, inviterId).map(GroupMember::canInviteMembers).orElse(false))
            .filter(g -> groupMemberJooqRepository.findByGroupIdAndUserId(groupId, inviteeId).isEmpty())
            .flatMap(g -> userJooqRepository.findById(inviteeId))
            .map(invitee -> {
                GroupMember member = GroupMember.builder()
                    .groupId(groupId)
                    .userId(inviteeId)
                    .status("pending")
                    .invitedBy(inviterId)
                    .build();
                return groupMemberJooqRepository.save(member);
            });
    }

    @Transactional(readOnly = true)
    public List<GroupInvitationDto> getPendingInvitations(UUID userId) {
        return groupMemberJooqRepository.findByUserIdAndStatus(userId, "pending").stream()
            .map(member -> {
                Group group = groupJooqRepository.findById(member.getGroupId()).orElse(null);
                return GroupInvitationDto.builder()
                    .id(member.getId())
                    .groupId(member.getGroupId())
                    .groupName(group != null ? group.getName() : null)
                    .invitedByUserId(member.getInvitedBy())
                    .invitedByDisplayName(displayNameOf(member.getInvitedBy()))
                    .invitedAt(member.getInvitedAt())
                    .build();
            })
            .collect(Collectors.toList());
    }

    @Transactional
    public Optional<GroupMember> respondToInvitation(UUID invitationId, UUID userId, boolean accept) {
        return groupMemberJooqRepository.findById(invitationId)
            .filter(m -> m.getUserId().equals(userId) && "pending".equals(m.getStatus()))
            .map(member -> {
                if (accept) {
                    member.setStatus("accepted");
                    member.setAcceptedAt(OffsetDateTime.now());
                    return groupMemberJooqRepository.save(member);
                } else {
                    groupMemberJooqRepository.delete(member);
                    return null;
                }
            });
    }

    /** Admin-only: grant/revoke a member's permission flags, or promote/demote admin
     *  status. Refuses to demote the group's last accepted admin. */
    @Transactional
    public Optional<GroupMember> updateMemberPermissions(UUID groupId, UUID actingUserId, UUID memberId,
            Boolean isAdmin, Boolean canEditInfo, Boolean canManagePlaylists, Boolean canInviteMembers, Boolean canRemoveMembers) {
        boolean actingIsAdmin = memberOf(groupId, actingUserId).map(GroupMember::getIsAdmin).map(Boolean.TRUE::equals).orElse(false);
        if (!actingIsAdmin) {
            return Optional.empty();
        }
        return groupMemberJooqRepository.findById(memberId)
            .filter(m -> m.getGroupId().equals(groupId))
            .filter(m -> {
                boolean demotingLastAdmin = Boolean.TRUE.equals(m.getIsAdmin()) && Boolean.FALSE.equals(isAdmin)
                    && groupMemberJooqRepository.countAcceptedAdmins(groupId) <= 1;
                return !demotingLastAdmin;
            })
            .map(member -> {
                if (isAdmin != null) member.setIsAdmin(isAdmin);
                if (canEditInfo != null) member.setCanEditInfo(canEditInfo);
                if (canManagePlaylists != null) member.setCanManagePlaylists(canManagePlaylists);
                if (canInviteMembers != null) member.setCanInviteMembers(canInviteMembers);
                if (canRemoveMembers != null) member.setCanRemoveMembers(canRemoveMembers);
                return groupMemberJooqRepository.save(member);
            });
    }

    /** Admins can remove anyone, including each other, as long as another accepted
     *  admin remains. A member with canRemoveMembers may remove non-admin members.
     *  Anyone may remove themselves (leave), subject to the same last-admin guard. */
    @Transactional
    public boolean removeMember(UUID groupId, UUID actingUserId, UUID memberId) {
        Optional<GroupMember> actingMembership = memberOf(groupId, actingUserId);
        return groupMemberJooqRepository.findById(memberId)
            .filter(m -> m.getGroupId().equals(groupId))
            .filter(target -> {
                boolean isSelf = target.getUserId().equals(actingUserId);
                boolean actingIsAdmin = actingMembership.map(GroupMember::getIsAdmin).map(Boolean.TRUE::equals).orElse(false);
                boolean actingCanRemove = actingMembership.map(GroupMember::canRemoveMembers).orElse(false);
                if (!isSelf && !actingIsAdmin && !actingCanRemove) {
                    return false;
                }
                if (!isSelf && !actingIsAdmin && Boolean.TRUE.equals(target.getIsAdmin())) {
                    return false;
                }
                boolean isLastAdmin = Boolean.TRUE.equals(target.getIsAdmin()) && target.isAccepted()
                    && groupMemberJooqRepository.countAcceptedAdmins(groupId) <= 1;
                return !isLastAdmin;
            })
            .map(target -> {
                groupMemberJooqRepository.delete(target);
                return true;
            })
            .orElse(false);
    }

    // ===== Group playlists =====

    @Transactional
    public Optional<Playlist> createPlaylist(UUID groupId, UUID userId, String name, String description) {
        return playlistService.createForGroup(groupId, userId, name, description);
    }

    // ===== Helpers =====

    private Optional<GroupMember> memberOf(UUID groupId, UUID userId) {
        return groupMemberJooqRepository.findByGroupIdAndUserId(groupId, userId)
            .filter(GroupMember::isAccepted);
    }

    private boolean canView(Group group, UUID viewerId) {
        return Boolean.TRUE.equals(group.getIsPublic()) || memberOf(group.getId(), viewerId).isPresent();
    }

    private String displayNameOf(UUID userId) {
        if (userId == null) return null;
        return userJooqRepository.findById(userId).map(User::getDisplayName).orElse(null);
    }

    private GroupSummaryDto toSummaryDto(Group group) {
        int memberCount = (int) groupMemberJooqRepository.findByGroupId(group.getId()).stream()
            .filter(GroupMember::isAccepted)
            .count();
        return GroupSummaryDto.builder()
            .id(group.getId())
            .name(group.getName())
            .isPublic(group.getIsPublic())
            .memberCount(memberCount)
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

    private GroupDto toGroupDto(Group group) {
        List<GroupMemberDto> members = groupMemberJooqRepository.findByGroupId(group.getId()).stream()
            .map(this::toMemberDto)
            .collect(Collectors.toList());
        List<PlaylistSummaryDto> playlists = playlistService.findByGroupIdAsSummaryDtos(group.getId());
        return GroupDto.builder()
            .id(group.getId())
            .name(group.getName())
            .aboutUs(group.getAboutUs())
            .isPublic(group.getIsPublic())
            .createdAt(group.getCreatedAt())
            .updatedAt(group.getUpdatedAt())
            .members(members)
            .playlists(playlists)
            .build();
    }
}
