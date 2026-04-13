package se.dansbart.dto;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CollaboratorDto {

    private UUID id;
    private UUID userId;
    private String username;
    private String displayName;
    private String permission;
    private String status;
    private OffsetDateTime invitedAt;
    private OffsetDateTime acceptedAt;
}
