package se.dansbart.domain.artist;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import se.dansbart.domain.album.Album;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "artists")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Artist {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "spotify_id", unique = true)
    private String spotifyId;

    @Column(name = "is_verified")
    @Builder.Default
    private Boolean isVerified = false;

    @JsonIgnore
    @OneToMany(mappedBy = "artist", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TrackArtist> trackLinks = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "artist", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Album> albums = new ArrayList<>();
}
