package se.dansbart.dto;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvitationDto {

    private UUID id;
    private UUID playlistId;
    private String playlistName;
    private String invitedByUserId;
    private String invitedByDisplayName;
    private String permission;
    private OffsetDateTime invitedAt;
}
