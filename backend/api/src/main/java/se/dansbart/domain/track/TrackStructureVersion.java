package se.dansbart.domain.track;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackStructureVersion {

    private UUID id;
    private UUID trackId;
    private Track track;
    private OffsetDateTime createdAt;
    private String description;
    private Map<String, Object> structureData;

    @Builder.Default
    private Integer voteCount = 1;

    @Builder.Default
    private Integer reportCount = 0;

    @Builder.Default
    private Boolean isActive = false;

    @Builder.Default
    private Boolean isHidden = false;

    private String authorAlias;
}
