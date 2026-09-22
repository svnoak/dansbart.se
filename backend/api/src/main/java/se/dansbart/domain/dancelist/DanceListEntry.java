package se.dansbart.domain.dancelist;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DanceListEntry {

    private UUID id;
    private UUID danceListId;
    private UUID danceId;
    private String freeTextName;
    private UUID suggestionId;

    @Builder.Default
    private String playMode = "in_order";

    private Integer position;
    private OffsetDateTime createdAt;
}
