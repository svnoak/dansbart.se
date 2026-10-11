package se.dansbart.domain.submission;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.artist.ArtistJooqRepository;
import se.dansbart.domain.track.PlaybackLink;
import se.dansbart.domain.track.PlaybackLinkJooqRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.worker.TaskDispatcher;

import java.util.UUID;

/**
 * Creates a catalog track for a YouTube video, which has no ingest worker of its own:
 * the artist by name, the track as PENDING, the video as its playback link (the audio
 * worker downloads that video instead of searching, and cleanup-orphans keeps tracks
 * that have a link), then audio analysis.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class YouTubeTrackCreator {

    private final TrackJooqRepository trackRepository;
    private final ArtistJooqRepository artistRepository;
    private final PlaybackLinkJooqRepository playbackLinkRepository;
    private final TaskDispatcher taskDispatcher;

    @Transactional
    public UUID create(TrackSubmission s) {
        Track track = new Track();
        track.setId(UUID.randomUUID());
        track.setTitle(s.getTitle());
        track.setIsPrivate(false);
        track.setProcessingStatus("PENDING");
        trackRepository.insert(track);

        if (s.getArtistName() != null && !s.getArtistName().isBlank()) {
            String name = s.getArtistName().trim();
            Artist artist = artistRepository.findByNameIgnoreCase(name)
                .orElseGet(() -> artistRepository.insert(Artist.builder().name(name).isVerified(false).build()));
            trackRepository.insertTrackArtist(track.getId(), artist.getId(), "primary");
        }

        playbackLinkRepository.insert(PlaybackLink.builder()
            .trackId(track.getId())
            .platform(MusicLink.Provider.YOUTUBE.dbValue())
            .deepLink(s.getExternalId())
            .isWorking(true)
            .build());

        taskDispatcher.dispatchAudioAnalysis(track.getId());
        log.info("Created track {} from YouTube video {}", track.getId(), s.getExternalId());
        return track.getId();
    }
}
