package se.dansbart.domain.admin;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RejectionLog {

    private UUID id;
    private String entityType;
    private String spotifyId;
    private String entityName;
    private String reason;
    private OffsetDateTime rejectedAt;

    @Builder.Default
    private Boolean deletedContent = true;

    private Map<String, Object> additionalData;
}
