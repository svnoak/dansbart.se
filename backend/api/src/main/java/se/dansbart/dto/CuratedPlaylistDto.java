package se.dansbart.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import se.dansbart.domain.track.Track;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CuratedPlaylistDto {
    private String id;
    private String name;
    private String description;
    private int trackCount;
    private List<Track> tracks;
}
