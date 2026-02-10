package se.dansbart.domain.playlist;

import lombok.*;
import se.dansbart.domain.track.Track;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaylistTrack {

    private UUID id;
    private UUID playlistId;
    private UUID trackId;
    private Integer position;
    private OffsetDateTime addedAt;

    private Playlist playlist;
    private Track track;
}
