package se.dansbart.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DanceListInvitationDto {

    private UUID id;
    private UUID danceListId;
    private String danceListName;
    private UUID invitedByUserId;
    private String invitedByDisplayName;
    private String permission;
    private OffsetDateTime invitedAt;
}
