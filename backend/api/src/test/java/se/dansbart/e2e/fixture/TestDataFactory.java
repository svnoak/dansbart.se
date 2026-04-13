package se.dansbart.e2e.fixture;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import se.dansbart.domain.album.Album;
import se.dansbart.domain.album.AlbumJooqRepository;
import se.dansbart.domain.album.TrackAlbum;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.artist.ArtistJooqRepository;
import se.dansbart.domain.artist.TrackArtist;
import se.dansbart.domain.playlist.Playlist;
import se.dansbart.domain.playlist.PlaylistJooqRepository;
import se.dansbart.domain.playlist.PlaylistTrack;
import se.dansbart.domain.playlist.PlaylistTrackJooqRepository;
import se.dansbart.domain.track.PlaybackLink;
import se.dansbart.domain.track.PlaybackLinkJooqRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackDanceStyle;
import se.dansbart.domain.track.TrackDanceStyleJooqRepository;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.domain.user.PlaylistCollaborator;
import se.dansbart.domain.user.PlaylistCollaboratorJooqRepository;
import se.dansbart.domain.user.User;
import se.dansbart.domain.user.UserJooqRepository;

import java.util.UUID;

/**
 * Factory for creating test data with a fluent builder API.
 *
 * Usage:
 *   User user = testData.user().withId(uuid).withUsername("john").build();
 *   Artist artist = testData.artist().withName("Folk Band").verified().build();
 *   Track track = testData.track().withTitle("Polska").withArtist(artist).complete().build();
 *   Playlist playlist = testData.playlist().withName("My List").withOwner(user).build();
 */
@Component
public class TestDataFactory {

    @Autowired
    private UserJooqRepository userJooqRepository;

    @Autowired
    private ArtistJooqRepository artistJooqRepository;

    @Autowired
    private AlbumJooqRepository albumJooqRepository;

    @Autowired
    private TrackJooqRepository trackJooqRepository;

    @Autowired
    private TrackDanceStyleJooqRepository trackDanceStyleJooqRepository;

    @Autowired
    private PlaybackLinkJooqRepository playbackLinkJooqRepository;

    @Autowired
    private PlaylistJooqRepository playlistJooqRepository;

    @Autowired
    private PlaylistTrackJooqRepository playlistTrackJooqRepository;

    @Autowired
    private PlaylistCollaboratorJooqRepository playlistCollaboratorJooqRepository;

    // Builder factory methods
    public UserBuilder user() {
        return new UserBuilder();
    }

    public ArtistBuilder artist() {
        return new ArtistBuilder();
    }

    public AlbumBuilder album() {
        return new AlbumBuilder();
    }

    public TrackBuilder track() {
        return new TrackBuilder();
    }

    public PlaylistBuilder playlist() {
        return new PlaylistBuilder();
    }

    /**
     * Link a track to an album (creates track_albums row).
     */
    public Album addTrackToAlbum(Album album, Track track) {
        albumJooqRepository.insertTrackAlbum(track.getId(), album.getId());
        return album;
    }

    // User Builder
    public class UserBuilder {
        private UUID id = UUID.randomUUID();
        private String discourseId;
        private String username;
        private String displayName = "Test User";
        private String avatarUrl;
        private String role = "USER";

        public UserBuilder withId(UUID id) {
            this.id = id;
            return this;
        }

        public UserBuilder withDiscourseId(String discourseId) {
            this.discourseId = discourseId;
            return this;
        }

        public UserBuilder withUsername(String username) {
            this.username = username;
            return this;
        }

        public UserBuilder withDisplayName(String displayName) {
            this.displayName = displayName;
            return this;
        }

        public UserBuilder withAvatarUrl(String avatarUrl) {
            this.avatarUrl = avatarUrl;
            return this;
        }

        public UserBuilder withRole(String role) {
            this.role = role;
            return this;
        }

        public User build() {
            String resolvedDiscourseId = discourseId != null ? discourseId : "discourse_" + id;
            User user = User.builder()
                .id(id)
                .discourseId(resolvedDiscourseId)
                .username(username != null ? username : "user_" + id.toString().substring(0, 8))
                .displayName(displayName)
                .avatarUrl(avatarUrl)
                .role(role)
                .build();
            return userJooqRepository.insert(user);
        }
    }

    // Artist Builder
    public class ArtistBuilder {
        private String name = "Test Artist";
        private String spotifyId;
        private String imageUrl;
        private boolean isVerified = false;

        public ArtistBuilder withName(String name) {
            this.name = name;
            return this;
        }

        public ArtistBuilder withSpotifyId(String spotifyId) {
            this.spotifyId = spotifyId;
            return this;
        }

        public ArtistBuilder withImageUrl(String imageUrl) {
            this.imageUrl = imageUrl;
            return this;
        }

        public ArtistBuilder verified() {
            this.isVerified = true;
            return this;
        }

        public Artist build() {
            Artist artist = Artist.builder()
                .name(name)
                .spotifyId(spotifyId != null ? spotifyId : "spotify_" + UUID.randomUUID())
                .imageUrl(imageUrl)
                .isVerified(isVerified)
                .build();
            return artistJooqRepository.insert(artist);
        }
    }

    // Album Builder
    public class AlbumBuilder {
        private String title = "Test Album";
        private String spotifyId;
        private String coverImageUrl;
        private String releaseDate;
        private Artist artist;

        public AlbumBuilder withTitle(String title) {
            this.title = title;
            return this;
        }

        public AlbumBuilder withSpotifyId(String spotifyId) {
            this.spotifyId = spotifyId;
            return this;
        }

        public AlbumBuilder withCoverImageUrl(String coverImageUrl) {
            this.coverImageUrl = coverImageUrl;
            return this;
        }

        public AlbumBuilder withReleaseDate(String releaseDate) {
            this.releaseDate = releaseDate;
            return this;
        }

        public AlbumBuilder withArtist(Artist artist) {
            this.artist = artist;
            return this;
        }

        public Album build() {
            Album album = Album.builder()
                .title(title)
                .spotifyId(spotifyId != null ? spotifyId : "spotify_album_" + UUID.randomUUID())
                .coverImageUrl(coverImageUrl)
                .releaseDate(releaseDate)
                .artistId(artist != null ? artist.getId() : null)
                .build();
            return albumJooqRepository.insert(album);
        }
    }

    // Track Builder
    public class TrackBuilder {
        private String title = "Test Track";
        private String isrc;
        private Integer durationMs = 180000;
        private String processingStatus = "PENDING";
        private Boolean hasVocals;
        private Float swingRatio;
        private Float articulation;
        private Float bounciness;
        private Float loudness;
        private float[] embedding;
        private Artist artist;
        private String danceStyle;
        private Integer effectiveBpm = 120;
        private boolean addPlaybackLink = false;

        public TrackBuilder withTitle(String title) {
            this.title = title;
            return this;
        }

        public TrackBuilder withIsrc(String isrc) {
            this.isrc = isrc;
            return this;
        }

        public TrackBuilder withDurationMs(int durationMs) {
            this.durationMs = durationMs;
            return this;
        }

        public TrackBuilder withHasVocals(boolean hasVocals) {
            this.hasVocals = hasVocals;
            return this;
        }

        public TrackBuilder withSwingRatio(float swingRatio) {
            this.swingRatio = swingRatio;
            return this;
        }

        public TrackBuilder withArticulation(float articulation) {
            this.articulation = articulation;
            return this;
        }

        public TrackBuilder withBounciness(float bounciness) {
            this.bounciness = bounciness;
            return this;
        }

        public TrackBuilder withLoudness(float loudness) {
            this.loudness = loudness;
            return this;
        }

        public TrackBuilder withEmbedding(float[] embedding) {
            this.embedding = embedding;
            return this;
        }

        public TrackBuilder withArtist(Artist artist) {
            this.artist = artist;
            return this;
        }

        public TrackBuilder withDanceStyle(String style) {
            this.danceStyle = style;
            return this;
        }

        public TrackBuilder withEffectiveBpm(int bpm) {
            this.effectiveBpm = bpm;
            return this;
        }

        public TrackBuilder pending() {
            this.processingStatus = "PENDING";
            this.addPlaybackLink = false;
            return this;
        }

        /**
         * Mark track as complete/done and playable.
         * This sets processing_status to "DONE" and creates a working playback link.
         * Note: For the track to be discoverable via findPlayableTracks(), you must also
         * call withDanceStyle() to set a dance style explicitly.
         */
        public TrackBuilder complete() {
            this.processingStatus = "DONE";
            this.addPlaybackLink = true;
            return this;
        }

        public TrackBuilder failed() {
            this.processingStatus = "FAILED";
            this.addPlaybackLink = false;
            return this;
        }

        public Track build() {
            Track track = Track.builder()
                .title(title)
                .isrc(isrc != null ? isrc : "ISRC" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .durationMs(durationMs)
                .processingStatus(processingStatus)
                .hasVocals(hasVocals)
                .swingRatio(swingRatio)
                .articulation(articulation)
                .bounciness(bounciness)
                .loudness(loudness)
                .embedding(embedding)
                .build();

            track = trackJooqRepository.insert(track);

            // Link to artist if provided
            if (artist != null) {
                trackJooqRepository.insertTrackArtist(track.getId(), artist.getId(), "primary");
            }

            // Add dance style if provided
            if (danceStyle != null) {
                TrackDanceStyle tds = TrackDanceStyle.builder()
                    .trackId(track.getId())
                    .danceStyle(danceStyle)
                    .isPrimary(true)
                    .confidence(0.9f)
                    .effectiveBpm(effectiveBpm)
                    .build();
                trackDanceStyleJooqRepository.save(tds);
            }

            // Add playback link if requested (required for tracks to be "playable")
            if (addPlaybackLink) {
                PlaybackLink link = PlaybackLink.builder()
                    .trackId(track.getId())
                    .platform("spotify")
                    .deepLink("spotify:track:" + UUID.randomUUID())
                    .isWorking(true)
                    .build();
                playbackLinkJooqRepository.insert(link);
            }

            return track;
        }
    }

    // Playlist Builder
    public class PlaylistBuilder {
        private String name = "Test Playlist";
        private String description;
        private UUID userId;
        private boolean isPublic = false;
        private String shareToken;

        public PlaylistBuilder withName(String name) {
            this.name = name;
            return this;
        }

        public PlaylistBuilder withDescription(String description) {
            this.description = description;
            return this;
        }

        public PlaylistBuilder withOwner(User owner) {
            this.userId = owner.getId();
            return this;
        }

        public PlaylistBuilder withOwnerId(UUID userId) {
            this.userId = userId;
            return this;
        }

        public PlaylistBuilder isPublic() {
            this.isPublic = true;
            return this;
        }

        public PlaylistBuilder withShareToken(String shareToken) {
            this.shareToken = shareToken;
            return this;
        }

        public Playlist build() {
            if (userId == null) {
                throw new IllegalStateException("Playlist must have an owner. Call withOwner() or withOwnerId().");
            }

            Playlist playlist = Playlist.builder()
                .name(name)
                .description(description)
                .userId(userId)
                .isPublic(isPublic)
                .shareToken(shareToken)
                .build();
            return playlistJooqRepository.insert(playlist);
        }
    }

    /**
     * Add an accepted collaborator to a playlist with the given permission.
     */
    public PlaylistCollaborator addCollaborator(Playlist playlist, User user, String permission) {
        PlaylistCollaborator collab = PlaylistCollaborator.builder()
            .playlistId(playlist.getId())
            .userId(user.getId())
            .permission(permission)
            .status("accepted")
            .invitedBy(playlist.getUserId())
            .build();
        return playlistCollaboratorJooqRepository.save(collab);
    }

    /**
     * Add a track to a playlist at the given position.
     */
    public PlaylistTrack addTrackToPlaylist(Playlist playlist, Track track, int position) {
        PlaylistTrack pt = PlaylistTrack.builder()
            .playlistId(playlist.getId())
            .trackId(track.getId())
            .position(position)
            .build();
        return playlistTrackJooqRepository.insert(pt);
    }
}
