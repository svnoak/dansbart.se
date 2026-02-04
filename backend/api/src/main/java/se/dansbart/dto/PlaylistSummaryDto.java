package se.dansbart.dto;

import lombok.*;
import java.util.UUID;

/**
 * Minimal Playlist DTO for list views.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaylistSummaryDto {

    private UUID id;
    private String name;
    private String description;
    private Boolean isPublic;
    private Integer trackCount;
    private String ownerDisplayName;
}
