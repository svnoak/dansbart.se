package se.dansbart.domain.album;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import se.dansbart.domain.artist.Artist;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Album {

    private UUID id;

    private String title;

    private String coverImageUrl;

    private String releaseDate;

    private String spotifyId;

    private UUID artistId;

    @JsonIgnore
    private Artist artist;

    @JsonIgnore
    @Builder.Default
    private List<TrackAlbum> trackLinks = new ArrayList<>();
}
