package se.dansbart.domain;

import org.springframework.stereotype.Component;
import se.dansbart.domain.group.GroupMember;
import se.dansbart.domain.group.GroupMemberJooqRepository;

import java.util.UUID;
import java.util.function.BooleanSupplier;

/**
 * Permission rules shared by resources that a user or a group owns and that can be
 * shared with collaborators, for example a playlist or a dance list.
 */
@Component
public class CollaborationAccess {

    private final GroupMemberJooqRepository groupMemberJooqRepository;

    public CollaborationAccess(GroupMemberJooqRepository groupMemberJooqRepository) {
        this.groupMemberJooqRepository = groupMemberJooqRepository;
    }

    public boolean hasFullControl(UUID ownerUserId, UUID ownerGroupId, UUID userId) {
        if (ownerGroupId != null) {
            return groupMemberJooqRepository.findByGroupIdAndUserId(ownerGroupId, userId)
                .map(GroupMember::canManagePlaylists)
                .orElse(false);
        }
        return userId.equals(ownerUserId);
    }

    public boolean hasEditAccess(UUID ownerUserId, UUID ownerGroupId, UUID userId, BooleanSupplier hasEditCollaboration) {
        return hasFullControl(ownerUserId, ownerGroupId, userId) || hasEditCollaboration.getAsBoolean();
    }

    public boolean canView(boolean isPublic, UUID ownerGroupId, UUID viewerId,
                            BooleanSupplier hasEditAccess, BooleanSupplier hasAcceptedCollaboration) {
        if (isPublic) {
            return true;
        }
        if (hasEditAccess.getAsBoolean()) {
            return true;
        }
        if (hasAcceptedCollaboration.getAsBoolean()) {
            return true;
        }
        if (ownerGroupId != null) {
            return groupMemberJooqRepository.findByGroupIdAndUserId(ownerGroupId, viewerId)
                .map(GroupMember::isAccepted)
                .orElse(false);
        }
        return false;
    }
}
