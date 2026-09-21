package se.dansbart.dto;

import lombok.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupDto {

    private UUID id;
    private String name;
    private String aboutUs;
    private Boolean isPublic;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    private List<GroupMemberDto> members;
    private List<PlaylistSummaryDto> playlists;
}
