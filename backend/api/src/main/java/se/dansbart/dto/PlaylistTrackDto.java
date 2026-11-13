package se.dansbart.dto;

import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * DTO for a track within a playlist (includes position).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaylistTrackDto {

    private UUID id;
    private Integer position;
    private OffsetDateTime addedAt;
    private UUID addedByUserId;

    // True when someone added the track with the guest code of the list
    private Boolean addedByGuest;

    // Embedded track info
    private TrackListDto track;
}
