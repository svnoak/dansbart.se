package se.dansbart.dto;

import lombok.*;

import java.util.List;
import java.util.UUID;

/** Everything one pasted link produced. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackSubmissionBatchDto {
    private UUID batchId;
    private String provider;
    private String sourceKind;
    private String sourceName;
    /** True when at least one track waits for an admin. */
    private boolean needsReview;
    /** True when the link had more tracks than one submission takes. */
    private boolean truncated;
    private List<TrackSubmissionDto> items;
}
