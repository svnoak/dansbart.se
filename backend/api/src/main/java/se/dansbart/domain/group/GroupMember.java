package se.dansbart.domain.group;

import lombok.*;
import se.dansbart.domain.user.User;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A user's membership in a group. An admin can always do everything a group allows,
 * including removing another admin; a non-admin member's actual powers are exactly its
 * permission flags below. status mirrors PlaylistCollaborator: 'pending' until the
 * invitee accepts, then 'accepted'.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupMember {

    private UUID id;
    private UUID groupId;
    private UUID userId;

    @Builder.Default
    private Boolean isAdmin = false;

    @Builder.Default
    private Boolean canEditInfo = false;

    @Builder.Default
    private Boolean canManagePlaylists = false;

    @Builder.Default
    private Boolean canInviteMembers = false;

    @Builder.Default
    private Boolean canRemoveMembers = false;

    @Builder.Default
    private String status = "pending";

    private UUID invitedBy;
    private OffsetDateTime invitedAt;
    private OffsetDateTime acceptedAt;

    private Group group;
    private User user;

    public boolean isAccepted() {
        return "accepted".equals(status);
    }

    public boolean canEditInfo() {
        return isAccepted() && (Boolean.TRUE.equals(isAdmin) || Boolean.TRUE.equals(canEditInfo));
    }

    public boolean canManagePlaylists() {
        return isAccepted() && (Boolean.TRUE.equals(isAdmin) || Boolean.TRUE.equals(canManagePlaylists));
    }

    public boolean canInviteMembers() {
        return isAccepted() && (Boolean.TRUE.equals(isAdmin) || Boolean.TRUE.equals(canInviteMembers));
    }

    public boolean canRemoveMembers() {
        return isAccepted() && (Boolean.TRUE.equals(isAdmin) || Boolean.TRUE.equals(canRemoveMembers));
    }
}
