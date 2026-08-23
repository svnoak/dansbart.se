package se.dansbart.dto;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SuggestionDto {
    private UUID id;
    private String kind;
    private Map<String, Object> payload;
    private String note;
    private UUID voterId;
    private String status;
    private UUID reviewedBy;
    private OffsetDateTime reviewedAt;
    private String reviewNote;
    private UUID resolvedRefId;
    private OffsetDateTime activatedAt;
    private OffsetDateTime createdAt;
}
