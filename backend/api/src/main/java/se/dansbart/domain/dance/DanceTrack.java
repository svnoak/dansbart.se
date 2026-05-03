package se.dansbart.domain.dance;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DanceTrack {
    private UUID id;
    private UUID danceId;
    private UUID trackId;
    private UUID addedBy;
    private OffsetDateTime addedAt;
    private boolean isConfirmed;
    private UUID confirmedBy;
    private OffsetDateTime confirmedAt;

    // Denormalised fields populated by join queries
    private String danceName;
    private String trackTitle;
    private String trackArtistName;
}
