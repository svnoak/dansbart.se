package se.dansbart.domain.dancelist;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DanceListEntryTrack {

    private UUID id;
    private UUID entryId;
    private UUID trackId;
    private Integer position;
    private UUID voterId;

    @Builder.Default
    private Boolean voteCast = false;

    private OffsetDateTime createdAt;
}
