package se.dansbart.dto;

import lombok.*;
import java.util.UUID;

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
