package se.dansbart.dto;

import lombok.*;
import java.util.UUID;

/** Playlist entry in the current user's playlist list, owned by the user or by one of their groups. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaylistListItemDto {

    private UUID id;
    private String name;
    private String description;
    private Boolean isPublic;
    private String danceStyle;
    private String subStyle;
    private String tempoCategory;
    private Integer trackCount;
    private GroupSummaryDto ownerGroup;
}
