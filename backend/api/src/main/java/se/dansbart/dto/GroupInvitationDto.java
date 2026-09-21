package se.dansbart.dto;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupInvitationDto {

    private UUID id;
    private UUID groupId;
    private String groupName;
    private UUID invitedByUserId;
    private String invitedByDisplayName;
    private OffsetDateTime invitedAt;
}
