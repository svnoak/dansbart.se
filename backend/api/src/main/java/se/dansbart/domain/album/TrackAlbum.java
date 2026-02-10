package se.dansbart.domain.album;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import se.dansbart.domain.track.Track;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackAlbum {

    private UUID id;
    private UUID trackId;
    private UUID albumId;

    @JsonIgnore
    private Track track;

    @JsonIgnore
    private Album album;
}
