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
public class AnalysisSource {

    private UUID id;
    private UUID trackId;
    private Track track;
    private String sourceType;
    private Map<String, Object> rawData;

    @Builder.Default
    private Float confidenceScore = 1.0f;

    private OffsetDateTime analyzedAt;
}
