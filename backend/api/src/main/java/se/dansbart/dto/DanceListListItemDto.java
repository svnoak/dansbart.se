package se.dansbart.dto;

import lombok.*;
import java.util.UUID;

/** A dance list as shown in a list view, such as the site's public dance lists. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DanceListListItemDto {

    private UUID id;
    private String name;
    private String description;
    private Boolean isPublic;
    private Integer entryCount;
    private GroupSummaryDto ownerGroup;
    private String ownerDisplayName;
}
