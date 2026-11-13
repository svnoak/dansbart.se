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
    private String shareToken;

    // The code that lets anyone add to the list; only sent to a viewer who can manage the list
    private String guestCode;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    private UserSummaryDto owner;
    private GroupSummaryDto ownerGroup;
    private Boolean viewerCanManage;

    // Whether the viewer owns the list or manages it for its group; null when the viewer is unknown
    private Boolean viewerHasFullControl;

    private List<DanceListEntryDto> entries;
    private List<CollaboratorDto> collaborators;
}
