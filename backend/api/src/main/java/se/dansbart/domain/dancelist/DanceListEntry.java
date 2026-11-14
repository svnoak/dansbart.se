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

    // What the people who edit the list wrote about the dance, and where it is described
    private String description;
    private String descriptionUrl;

    @Builder.Default
    private String playMode = "in_order";

    private Integer position;

    @Builder.Default
    private Boolean addedByGuest = false;
    private OffsetDateTime createdAt;
}
