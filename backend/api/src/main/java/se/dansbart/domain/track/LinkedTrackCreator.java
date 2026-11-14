package se.dansbart.domain.track;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import se.dansbart.domain.album.AlbumJooqRepository;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.artist.ArtistJooqRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Creates a public track from a YouTube or Spotify link, without any worker. Used when
 * a person adds a track and when an admin imports from Spotify.
 *
 * The track is PENDING and has the link as its playback link. The audio analysis,
 * dispatched by the caller, downloads a YouTube video directly and for a Spotify link
 * searches YouTube by artist and title. The uploader is recorded, so the track is listed
 * at once, before its analysis.
 */
@Component
@RequiredArgsConstructor
public class LinkedTrackCreator {

    private final TrackJooqRepository trackRepository;
    private final PlaybackLinkJooqRepository playbackLinkRepository;
    private final ArtistJooqRepository artistRepository;
    private final AlbumJooqRepository albumRepository;

    /** An artist of the track. The Spotify id is null when it is not known. */
    public record ArtistRef(String name, String spotifyId) {}

    /**
     * @param platform   "youtube" or "spotify"
     * @param externalId the video id or Spotify track id
     * @param isrc       the ISRC when known; the feature worker matches Spotify imports by it
     * @return the new track's id
     */
    public UUID create(String platform, String externalId, String title, String artistName,
                       Integer durationMs, String isrc, UUID uploaderId) {
        List<ArtistRef> artists = artistName != null && !artistName.isBlank()
            ? List.of(new ArtistRef(artistName, null)) : List.of();
        return create(platform, externalId, title, artists, durationMs, isrc, null, uploaderId);
    }

    /**
     * Creates the track with all its artists, the first as primary and the others as
     * featured, and links it to the album when one is given.
     */
    public UUID create(String platform, String externalId, String title, List<ArtistRef> artists,
                       Integer durationMs, String isrc, UUID albumId, UUID uploaderId) {
        Track track = new Track();
        track.setId(UUID.randomUUID());
        track.setTitle(title);
        track.setDurationMs(durationMs);
        track.setIsrc(isrc);
        track.setProcessingStatus("PENDING");
        track.setIsPrivate(false);
        track.setUploaderId(uploaderId);
        trackRepository.insert(track);

        for (int i = 0; i < artists.size(); i++) {
            Artist artist = findOrCreateArtist(artists.get(i));
            trackRepository.insertTrackArtist(track.getId(), artist.getId(), i == 0 ? "primary" : "featured");
        }
        if (albumId != null) {
            albumRepository.insertTrackAlbum(track.getId(), albumId);
        }

        PlaybackLink link = new PlaybackLink();
        link.setTrackId(track.getId());
        link.setPlatform(platform);
        link.setDeepLink(externalId);
        link.setIsWorking(true);
        playbackLinkRepository.insert(link);
        return track.getId();
    }

    /** Finds the artist by Spotify id, then by name, and creates it when neither matches. */
    public Artist findOrCreateArtist(ArtistRef ref) {
        if (ref.spotifyId() != null) {
            Optional<Artist> bySpotifyId = artistRepository.findBySpotifyId(ref.spotifyId());
            if (bySpotifyId.isPresent()) return bySpotifyId.get();
        }
        return artistRepository.findFirstByNameIgnoreCase(ref.name()).orElseGet(() -> {
            Artist created = new Artist();
            created.setName(ref.name());
            created.setSpotifyId(ref.spotifyId());
            created.setIsVerified(false);
            return artistRepository.insert(created);
        });
    }
}
