package se.dansbart.dto;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupMemberDto {

    private UUID id;
    private UUID userId;
    private String username;
    private String displayName;
    private String avatarUrl;
    private Boolean isAdmin;
    private Boolean canEditInfo;
    private Boolean canManagePlaylists;
    private Boolean canInviteMembers;
    private Boolean canRemoveMembers;
    private String status;
    private OffsetDateTime invitedAt;
    private OffsetDateTime acceptedAt;
}
