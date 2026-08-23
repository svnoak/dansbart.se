package se.dansbart.domain.dance;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import se.dansbart.domain.track.TrackFeedbackService;
import se.dansbart.domain.track.TrackJooqRepository;

import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression guard for a non-obvious cross-feature coupling: an upvote on a dance's
 * track recommendation (DanceService.voteOnTrack) also feeds the same style-consensus
 * tally used by the anonymous classification surfaces (musikdomaren / SmartNudge), via
 * TrackFeedbackService.submitStyleFeedback. This locks in that existing behavior so any
 * future change to the shared vote/threshold logic has to touch this test deliberately
 * rather than silently changing both surfaces at once.
 */
@ExtendWith(MockitoExtension.class)
class DanceServiceVoteThresholdTest {

    @Mock
    private DanceJooqRepository danceJooqRepository;

    @Mock
    private TrackJooqRepository trackJooqRepository;

    @Mock
    private DanceTrackVoteRepository voteRepository;

    @Mock
    private TrackFeedbackService trackFeedbackService;

    private DanceService danceService() {
        return new DanceService(danceJooqRepository, trackJooqRepository, voteRepository, trackFeedbackService);
    }

    @Test
    void upvote_feedsSharedStyleConsensusTallyWithDanceType() {
        UUID danceId = UUID.randomUUID();
        UUID trackId = UUID.randomUUID();
        String voterId = "voter-1";
        Dance dance = Dance.builder().danceType("Polska").build();

        when(danceJooqRepository.findById(danceId)).thenReturn(Optional.of(dance));

        danceService().voteOnTrack(danceId, trackId, voterId, 1);

        verify(voteRepository).upsertVote(danceId, trackId, voterId, 1);
        verify(danceJooqRepository).addTrackConfirmed(danceId, trackId, null);
        verify(trackFeedbackService).submitStyleFeedback(trackId, voterId, "Polska", null);
    }

    @Test
    void upvote_withBlankDanceType_doesNotFeedStyleConsensusTally() {
        UUID danceId = UUID.randomUUID();
        UUID trackId = UUID.randomUUID();
        String voterId = "voter-1";
        Dance dance = Dance.builder().danceType("  ").build();

        when(danceJooqRepository.findById(danceId)).thenReturn(Optional.of(dance));

        danceService().voteOnTrack(danceId, trackId, voterId, 1);

        verify(trackFeedbackService, never()).submitStyleFeedback(any(), any(), any(), any());
    }

    @Test
    void downvote_neverFeedsStyleConsensusTally() {
        UUID danceId = UUID.randomUUID();
        UUID trackId = UUID.randomUUID();
        String voterId = "voter-1";

        danceService().voteOnTrack(danceId, trackId, voterId, -1);

        verify(voteRepository).upsertVote(danceId, trackId, voterId, -1);
        verify(danceJooqRepository, never()).addTrackConfirmed(any(), any(), any());
        verify(danceJooqRepository, never()).findById(any());
        verify(trackFeedbackService, never()).submitStyleFeedback(any(), any(), any(), any());
    }
}
