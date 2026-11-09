package se.dansbart.domain.contribution;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.StyleKeywordJooqRepository;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.dto.AdminContributionCountDto;
import se.dansbart.dto.AdminContributionsDto;
import se.dansbart.exception.ResourceNotFoundException;

import java.util.UUID;

/**
 * The admin's review queue of tracks and dance styles that users added. Additions are
 * public already; reviewing only clears them from the queue, and removing undoes them.
 * Additions by admins are marked reviewed when they are made, so they never show up here.
 */
@Service
@RequiredArgsConstructor
public class AdminContributionService {

    private static final int LIST_LIMIT = 200;

    private final TrackSubmissionJooqRepository submissionRepository;
    private final StyleKeywordJooqRepository styleKeywordRepository;
    private final TrackJooqRepository trackRepository;

    @Transactional(readOnly = true)
    public AdminContributionsDto listUnreviewed() {
        return new AdminContributionsDto(
            submissionRepository.findUnreviewed(LIST_LIMIT),
            styleKeywordRepository.findUnreviewedContributed(LIST_LIMIT));
    }

    @Transactional(readOnly = true)
    public AdminContributionCountDto countUnreviewed() {
        return new AdminContributionCountDto(
            submissionRepository.countUnreviewed(),
            styleKeywordRepository.countUnreviewedContributed());
    }

    @Transactional
    public void approveTrack(UUID submissionId, UUID adminId) {
        if (!submissionRepository.markReviewed(submissionId, adminId)) {
            throw new ResourceNotFoundException("Submission not found");
        }
    }

    /**
     * Deletes the track if this submission created it. A track that was already in the
     * library stays. A Spotify submission still waiting for the worker is stopped.
     */
    @Transactional
    public void removeTrack(UUID submissionId, UUID adminId) {
        TrackSubmission s = submissionRepository.findById(submissionId)
            .orElseThrow(() -> new ResourceNotFoundException("Submission not found"));
        submissionRepository.markReviewed(submissionId, adminId);
        if (TrackSubmission.QUEUED.equals(s.status())) {
            submissionRepository.setStatus(submissionId, TrackSubmission.FAILED);
        }
        if (s.createdTrack() && s.trackId() != null) {
            // Deleting the track also deletes the submission row (ON DELETE CASCADE).
            trackRepository.deleteWithRelations(s.trackId());
        }
    }

    @Transactional
    public void approveStyle(UUID styleId) {
        if (!styleKeywordRepository.markContributionReviewed(styleId, false)) {
            throw new ResourceNotFoundException("Style not found");
        }
    }

    /** Hides the style from the style tree. Tracks keep any votes for it. */
    @Transactional
    public void removeStyle(UUID styleId) {
        if (!styleKeywordRepository.markContributionReviewed(styleId, true)) {
            throw new ResourceNotFoundException("Style not found");
        }
    }
}
