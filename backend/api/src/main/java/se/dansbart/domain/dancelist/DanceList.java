package se.dansbart.domain.dancelist;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DanceList {

    private UUID id;
    private UUID userId;
    private UUID groupId;
    private String name;
    private String description;

    @Builder.Default
    private Boolean isPublic = false;

    private String shareToken;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
