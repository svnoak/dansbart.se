package se.dansbart.dto;

import lombok.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * A public dance list as anyone sees it. It leaves out what only a person who manages the list
 * needs: the share token, the guest code, the collaborators and the viewer's rights.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PublicDanceListDto {

    private UUID id;
    private String name;
    private String description;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private UserSummaryDto owner;
    private GroupSummaryDto ownerGroup;
    private List<DanceListEntryDto> entries;
}
