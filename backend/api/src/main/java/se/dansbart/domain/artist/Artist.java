package se.dansbart.domain.artist;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import se.dansbart.domain.album.Album;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Artist {

    private UUID id;

    private String name;

    private String imageUrl;

    private String spotifyId;

    @Builder.Default
    private Boolean isVerified = false;

    private String description;

    @JsonIgnore
    @Builder.Default
    private List<TrackArtist> trackLinks = new ArrayList<>();

    @JsonIgnore
    @Builder.Default
    private List<Album> albums = new ArrayList<>();
}
