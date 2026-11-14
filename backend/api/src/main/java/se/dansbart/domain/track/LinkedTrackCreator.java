package se.dansbart.domain.track;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.artist.ArtistJooqRepository;

import java.util.UUID;

/**
 * Creates a public track from a YouTube or Spotify link, without any worker.
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

    /**
     * @param platform   "youtube" or "spotify"
     * @param externalId the video id or Spotify track id
     * @param isrc       the ISRC when known; the feature worker matches Spotify imports by it
     * @return the new track's id
     */
    public UUID create(String platform, String externalId, String title, String artistName,
                       Integer durationMs, String isrc, UUID uploaderId) {
        Track track = new Track();
        track.setId(UUID.randomUUID());
        track.setTitle(title);
        track.setDurationMs(durationMs);
        track.setIsrc(isrc);
        track.setProcessingStatus("PENDING");
        track.setIsPrivate(false);
        track.setUploaderId(uploaderId);
        trackRepository.insert(track);

        if (artistName != null && !artistName.isBlank()) {
            Artist artist = artistRepository.findFirstByNameIgnoreCase(artistName).orElseGet(() -> {
                Artist created = new Artist();
                created.setName(artistName);
                created.setIsVerified(false);
                return artistRepository.insert(created);
            });
            trackRepository.insertTrackArtist(track.getId(), artist.getId(), "primary");
        }

        PlaybackLink link = new PlaybackLink();
        link.setTrackId(track.getId());
        link.setPlatform(platform);
        link.setDeepLink(externalId);
        link.setIsWorking(true);
        playbackLinkRepository.insert(link);
        return track.getId();
    }
}
