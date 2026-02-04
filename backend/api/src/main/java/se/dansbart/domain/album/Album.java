package se.dansbart.domain.album;

import jakarta.persistence.*;
import lombok.*;
import se.dansbart.domain.artist.Artist;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "albums")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Album {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(name = "cover_image_url")
    private String coverImageUrl;

    @Column(name = "release_date")
    private String releaseDate;

    @Column(name = "spotify_id", unique = true)
    private String spotifyId;

    @Column(name = "artist_id")
    private UUID artistId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "artist_id", insertable = false, updatable = false)
    private Artist artist;

    @OneToMany(mappedBy = "album", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TrackAlbum> trackLinks = new ArrayList<>();
}
