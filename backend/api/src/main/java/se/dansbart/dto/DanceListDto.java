package se.dansbart.dto;

import lombok.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Full DanceList DTO for detail views.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DanceListDto {

    private UUID id;
    private String name;
    private String description;
    private Boolean isPublic;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    private UserSummaryDto owner;
    private GroupSummaryDto ownerGroup;

    private List<DanceListEntryDto> entries;
}
