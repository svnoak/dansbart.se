package se.dansbart.domain.group;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.user.User;
import se.dansbart.dto.GroupDto;
import se.dansbart.dto.GroupMemberDto;
import se.dansbart.dto.GroupSummaryDto;
import se.dansbart.exception.BadRequestException;
import se.dansbart.exception.ForbiddenException;
import se.dansbart.exception.ResourceNotFoundException;

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

    @Transactional
    public GroupDto create(UUID creatorId, String name, String aboutUs, Boolean isPublic) {
        String trimmedName = validateAndTrimName(name);
        Group group = Group.builder()
            .name(trimmedName)
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

        return toGroupDto(group);
    }

    @Transactional(readOnly = true)
    public Optional<GroupDto> findByIdAsDto(UUID groupId, UUID viewerId) {
        return groupJooqRepository.findById(groupId)
            .filter(g -> canView(g, viewerId))
            .map(g -> toGroupDto(g, memberOf(groupId, viewerId).isPresent()));
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
        if (!memberOf(groupId, userId).map(GroupMember::canEditInfo).orElse(false)) {
            throw new ForbiddenException("You do not have permission to change this group.");
        }
        String trimmedName = name != null ? validateAndTrimName(name) : null;
        if (trimmedName != null) group.setName(trimmedName);
        if (aboutUs != null) group.setAboutUs(aboutUs.isEmpty() ? null : aboutUs);
        if (isPublic != null) group.setIsPublic(isPublic);
        return toGroupDto(groupJooqRepository.update(group));
    }

    @Transactional
    public void delete(UUID groupId, UUID userId) {
        loadVisibleGroup(groupId, userId);
        if (!memberOf(groupId, userId).map(GroupMember::getIsAdmin).map(Boolean.TRUE::equals).orElse(false)) {
            throw new ForbiddenException("You do not have permission to delete this group.");
        }
        groupJooqRepository.delete(groupId);
    }

    private Group loadVisibleGroup(UUID groupId, UUID viewerId) {
        return groupJooqRepository.findById(groupId)
            .filter(g -> canView(g, viewerId))
            .orElseThrow(() -> new ResourceNotFoundException("The group does not exist, or you do not have access to it."));
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

    private boolean canView(Group group, UUID viewerId) {
        return Boolean.TRUE.equals(group.getIsPublic()) || memberOf(group.getId(), viewerId).isPresent();
    }

    private GroupSummaryDto toSummaryDto(GroupJooqRepository.GroupWithMemberCount groupWithMemberCount) {
        Group group = groupWithMemberCount.group();
        return GroupSummaryDto.builder()
            .id(group.getId())
            .name(group.getName())
            .isPublic(group.getIsPublic())
            .memberCount(groupWithMemberCount.memberCount())
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
        return toGroupDto(group, true);
    }

    private GroupDto toGroupDto(Group group, boolean includeMembers) {
        List<GroupMemberDto> members = includeMembers
            ? groupMemberJooqRepository.findByGroupId(group.getId()).stream()
                .map(this::toMemberDto)
                .collect(Collectors.toList())
            : null;
        return GroupDto.builder()
            .id(group.getId())
            .name(group.getName())
            .aboutUs(group.getAboutUs())
            .isPublic(group.getIsPublic())
            .createdAt(group.getCreatedAt())
            .updatedAt(group.getUpdatedAt())
            .members(members)
            .build();
    }
}
