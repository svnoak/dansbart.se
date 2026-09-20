package se.dansbart.dto;

import lombok.*;
import java.util.UUID;

/**
 * Minimal Group DTO for list views.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupSummaryDto {

    private UUID id;
    private String name;
    private Boolean isPublic;
    private Integer memberCount;
}
