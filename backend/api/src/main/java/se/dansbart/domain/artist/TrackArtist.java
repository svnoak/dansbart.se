package se.dansbart.domain.artist;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import se.dansbart.domain.track.Track;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackArtist {

    private UUID id;
    private UUID trackId;
    private UUID artistId;

    @Builder.Default
    private String role = "primary";

    @JsonIgnore
    private Track track;

    @JsonIgnore
    private Artist artist;
}
