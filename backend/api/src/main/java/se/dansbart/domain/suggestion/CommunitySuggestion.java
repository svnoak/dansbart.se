package se.dansbart.domain.suggestion;

import lombok.*;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommunitySuggestion {

    private UUID id;
    private String kind; // "content" | "dance_style"
    private Map<String, Object> payload;
    private String note;
    private UUID voterId;
    private String status; // "pending" | "accepted" | "activated" | "rejected"
    private UUID reviewedBy;
    private OffsetDateTime reviewedAt;
    private String reviewNote;
    private UUID resolvedRefId;
    private OffsetDateTime activatedAt;
    private OffsetDateTime createdAt;
}
