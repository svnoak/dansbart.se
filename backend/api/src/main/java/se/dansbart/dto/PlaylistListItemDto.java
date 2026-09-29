package se.dansbart.dto;

import lombok.*;
import java.util.UUID;

/** A playlist entry as shown in a list view — either the current user's own accessible playlists, or the site's public playlists. */
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
    private String ownerDisplayName;
}
