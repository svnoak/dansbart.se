package se.dansbart.domain.contribution;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import se.dansbart.domain.track.PlaybackLinkJooqRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackJooqRepository;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Follows user-added tracks through ingest and analysis.
 *
 * QUEUED (Spotify, only submissions made before the API created Spotify tracks itself):
 * once the worker has created a track with this Spotify link, the submission is linked
 * to it and the submitter's style is stored on it. A track the
 * worker created after the submission counts as created by it; an older one was
 * already in the library. After {@link #QUEUED_TIMEOUT} without a track, the
 * submission is FAILED (for example when the worker rejected the track).
 *
 * LINKED: once analysis has finished, the submitter's style is stored again. Analysis
 * may have marked a different style as primary, and the tempo is only known now.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TrackSubmissionResolverJob {

    static final Duration QUEUED_TIMEOUT = Duration.ofHours(6);
    private static final int BATCH = 100;

    private final TrackSubmissionJooqRepository submissionRepository;
    private final PlaybackLinkJooqRepository playbackLinkRepository;
    private final TrackJooqRepository trackRepository;
    private final ContributionService contributionService;
    private final TransactionTemplate transactionTemplate;

    @Scheduled(fixedDelayString = "${dansbart.contributions.resolve-delay-ms:60000}",
               initialDelayString = "${dansbart.contributions.resolve-delay-ms:60000}")
    public void run() {
        for (TrackSubmission s : submissionRepository.findByStatus(TrackSubmission.QUEUED, BATCH)) {
            runSafely(s, () -> resolveQueued(s));
        }
        for (TrackSubmission s : submissionRepository.findByStatus(TrackSubmission.LINKED, BATCH)) {
            runSafely(s, () -> finalizeLinked(s));
        }
    }

    void resolveQueued(TrackSubmission s) {
        Optional<UUID> trackId = playbackLinkRepository.findTrackIdByPlatformAndExternalId(
            s.source().toLowerCase(), s.externalId());
        if (trackId.isEmpty()) {
            if (s.createdAt() != null && s.createdAt().isBefore(OffsetDateTime.now().minus(QUEUED_TIMEOUT))) {
                submissionRepository.setStatus(s.id(), TrackSubmission.FAILED);
                log.info("Track submission {} failed: no track for {} {}", s.id(), s.source(), s.externalId());
            }
            return;
        }
        Optional<Track> track = trackRepository.findById(trackId.get());
        boolean createdTrack = track
            .map(t -> t.getCreatedAt() != null && s.createdAt() != null && !t.getCreatedAt().isBefore(s.createdAt()))
            .orElse(false);
        submissionRepository.markLinked(s.id(), trackId.get(), createdTrack);
        if (createdTrack) {
            trackRepository.setUploaderIfMissing(trackId.get(), s.userId());
        }
        contributionService.applySubmitterStyle(s, trackId.get(), createdTrack);
        log.info("Track submission {} linked to track {}", s.id(), trackId.get());
    }

    void finalizeLinked(TrackSubmission s) {
        if (s.trackId() == null) {
            submissionRepository.setStatus(s.id(), TrackSubmission.FAILED);
            return;
        }
        String status = trackRepository.findById(s.trackId()).map(Track::getProcessingStatus).orElse(null);
        if (status == null) {
            // The track was removed.
            submissionRepository.setStatus(s.id(), TrackSubmission.FAILED);
            return;
        }
        if ("DONE".equals(status)) {
            contributionService.applySubmitterStyle(s, s.trackId(), s.createdTrack());
            submissionRepository.setStatus(s.id(), TrackSubmission.DONE);
        } else if ("FAILED".equals(status)) {
            submissionRepository.setStatus(s.id(), TrackSubmission.FAILED);
        }
    }

    private void runSafely(TrackSubmission s, Runnable step) {
        try {
            transactionTemplate.executeWithoutResult(tx -> step.run());
        } catch (RuntimeException e) {
            log.warn("Could not resolve track submission {}: {}", s.id(), e.getMessage());
        }
    }
}
