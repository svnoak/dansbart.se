package se.dansbart.dto;

import lombok.*;
import java.util.List;
import java.util.UUID;

/**
 * DTO for an entry within a dance list (a dance from the site, or a typed name).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DanceListEntryDto {

    private UUID id;
    private UUID danceId;
    private String danceName;
    private String freeTextName;
    private String playMode;
    private Integer position;

    private List<PlaylistTrackDto> tracks;
}
