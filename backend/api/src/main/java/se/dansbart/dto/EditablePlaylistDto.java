package se.dansbart.dto;

import lombok.*;
import java.util.UUID;

/** Playlist a user can add tracks to, for use in "add to playlist" pickers. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EditablePlaylistDto {

    private UUID id;
    private String name;
    private String ownerGroupName;
}
