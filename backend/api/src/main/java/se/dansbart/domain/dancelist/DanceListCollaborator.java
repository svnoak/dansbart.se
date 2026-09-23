package se.dansbart.domain.dancelist;

import lombok.*;
import se.dansbart.domain.user.User;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DanceListCollaborator {

    private UUID id;
    private UUID danceListId;
    private UUID userId;

    @Builder.Default
    private String permission = "view";

    @Builder.Default
    private String status = "pending";

    private UUID invitedBy;
    private OffsetDateTime invitedAt;
    private OffsetDateTime acceptedAt;

    private User user;
}
