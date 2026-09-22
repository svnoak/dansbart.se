package se.dansbart.domain.dance;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import se.dansbart.domain.reputation.VoterReputationService;
import se.dansbart.domain.track.TrackFeedbackService;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.voter.VoterContext;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression guard for a non-obvious cross-feature coupling: an upvote on a dance's
 * track recommendation (DanceService.voteOnTrack) also feeds the same style-consensus
 * tally used by the anonymous classification surfaces (ClassifyPage / SmartNudge), via
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

    @Mock
    private VoterReputationService reputationService;

    @Mock
    private VoterContext voterContext;

    private DanceService danceService() {
        return new DanceService(
            danceJooqRepository, trackJooqRepository, voteRepository,
            trackFeedbackService, reputationService, voterContext);
    }

    private void stubVoter(String voterId) {
        lenient().when(voterContext.getVoterId()).thenReturn(UUID.fromString(voterId));
        lenient().when(reputationService.getWeightForCurrentVoter()).thenReturn(BigDecimal.ONE);
        lenient().when(voteRepository.weightedUpvoteSumByDanceAndTrack(any(), any()))
            .thenReturn(VoterReputationService.CONFIRMATION_THRESHOLD);
    }

    @Test
    void upvote_feedsSharedStyleConsensusTallyWithDanceType() {
        UUID danceId = UUID.randomUUID();
        UUID trackId = UUID.randomUUID();
        String voterId = "11111111-1111-1111-1111-111111111111";
        stubVoter(voterId);
        Dance dance = Dance.builder().danceType("Polska").build();

        when(danceJooqRepository.findById(danceId)).thenReturn(Optional.of(dance));

        danceService().voteOnTrack(danceId, trackId, 1);

        verify(voteRepository).upsertVote(danceId, trackId, UUID.fromString(voterId), 1, BigDecimal.ONE);
        verify(danceJooqRepository).addTrackConfirmed(danceId, trackId, null);
        verify(trackFeedbackService).submitStyleFeedback(trackId, "Polska", null);
    }

    @Test
    void upvote_withBlankDanceType_doesNotFeedStyleConsensusTally() {
        UUID danceId = UUID.randomUUID();
        UUID trackId = UUID.randomUUID();
        stubVoter("11111111-1111-1111-1111-111111111111");
        Dance dance = Dance.builder().danceType("  ").build();

        when(danceJooqRepository.findById(danceId)).thenReturn(Optional.of(dance));

        danceService().voteOnTrack(danceId, trackId, 1);

        verify(trackFeedbackService, never()).submitStyleFeedback(any(), any(), any());
    }

    @Test
    void downvote_neverFeedsStyleConsensusTally() {
        UUID danceId = UUID.randomUUID();
        UUID trackId = UUID.randomUUID();
        String voterId = "11111111-1111-1111-1111-111111111111";
        when(voterContext.getVoterId()).thenReturn(UUID.fromString(voterId));
        when(reputationService.getWeightForCurrentVoter()).thenReturn(BigDecimal.ONE);

        danceService().voteOnTrack(danceId, trackId, -1);

        verify(voteRepository).upsertVote(danceId, trackId, UUID.fromString(voterId), -1, BigDecimal.ONE);
        verify(danceJooqRepository, never()).addTrackConfirmed(any(), any(), any());
        verify(danceJooqRepository, never()).findById(any());
        verify(trackFeedbackService, never()).submitStyleFeedback(any(), any(), any());
    }

    @Test
    void singleAnonymousUpvote_doesNotConfirmTrack() {
        UUID danceId = UUID.randomUUID();
        UUID trackId = UUID.randomUUID();
        UUID voterId = UUID.randomUUID();
        when(voterContext.getVoterId()).thenReturn(voterId);
        when(reputationService.getWeightForCurrentVoter()).thenReturn(VoterReputationService.ANONYMOUS_WEIGHT);
        when(voteRepository.weightedUpvoteSumByDanceAndTrack(danceId, trackId))
            .thenReturn(VoterReputationService.ANONYMOUS_WEIGHT);

        danceService().voteOnTrack(danceId, trackId, 1);

        verify(danceJooqRepository, never()).addTrackConfirmed(any(), any(), any());
    }

    @Test
    void twoAnonymousUpvotes_confirmTrack() {
        UUID danceId = UUID.randomUUID();
        UUID trackId = UUID.randomUUID();
        UUID voterId = UUID.randomUUID();
        when(voterContext.getVoterId()).thenReturn(voterId);
        when(reputationService.getWeightForCurrentVoter()).thenReturn(VoterReputationService.ANONYMOUS_WEIGHT);
        when(voteRepository.weightedUpvoteSumByDanceAndTrack(danceId, trackId))
            .thenReturn(VoterReputationService.ANONYMOUS_WEIGHT.multiply(new BigDecimal("2")));

        danceService().voteOnTrack(danceId, trackId, 1);

        verify(danceJooqRepository).addTrackConfirmed(danceId, trackId, null);
    }

    @Test
    void upvoteFromSignedInVoterAtLowestReputation_confirmsTrack() {
        UUID danceId = UUID.randomUUID();
        UUID trackId = UUID.randomUUID();
        UUID voterId = UUID.randomUUID();
        // USER_BASE (2.0) * lowest reputation multiplier (0.30) = CONFIRMATION_THRESHOLD.
        BigDecimal lowestReputationWeight = VoterReputationService.CONFIRMATION_THRESHOLD;
        when(voterContext.getVoterId()).thenReturn(voterId);
        when(reputationService.getWeightForCurrentVoter()).thenReturn(lowestReputationWeight);
        when(voteRepository.weightedUpvoteSumByDanceAndTrack(danceId, trackId))
            .thenReturn(lowestReputationWeight);

        danceService().voteOnTrack(danceId, trackId, 1);

        verify(danceJooqRepository).addTrackConfirmed(danceId, trackId, null);
    }

    @Test
    void voteOnTrack_withNoVoterIdentity_throwsIllegalState() {
        UUID danceId = UUID.randomUUID();
        UUID trackId = UUID.randomUUID();
        when(voterContext.getVoterId()).thenReturn(null);

        try {
            danceService().voteOnTrack(danceId, trackId, 1);
            throw new AssertionError("expected IllegalStateException");
        } catch (IllegalStateException expected) {
            // matches DanceController's catch-and-400 handling for a missing voter identity
        }
        verify(voteRepository, never()).upsertVote(any(), any(), any(), anyInt(), any());
    }

    @Test
    void castVoteAsVoter_signedInVoter_confirmsTrackAlone() {
        UUID danceId = UUID.randomUUID();
        UUID trackId = UUID.randomUUID();
        UUID voterId = UUID.randomUUID();
        Dance dance = Dance.builder().danceType("Polska").build();
        BigDecimal lowestReputationWeight = VoterReputationService.CONFIRMATION_THRESHOLD;

        lenient().when(voterContext.getVoterId()).thenReturn(null);
        when(reputationService.getWeightForVoter(voterId)).thenReturn(lowestReputationWeight);
        when(danceJooqRepository.findById(danceId)).thenReturn(Optional.of(dance));
        when(voteRepository.weightedUpvoteSumByDanceAndTrack(danceId, trackId))
            .thenReturn(lowestReputationWeight);

        danceService().castVoteAsVoter(danceId, trackId, voterId, 1);

        verify(voteRepository).upsertVote(danceId, trackId, voterId, 1, lowestReputationWeight);
        verify(danceJooqRepository).addTrackConfirmed(danceId, trackId, null);
        verify(trackFeedbackService).submitStyleFeedback(trackId, "Polska", null);
    }

    @Test
    void withdrawVoteAsVoter_removesThatVotersVote() {
        UUID danceId = UUID.randomUUID();
        UUID trackId = UUID.randomUUID();
        UUID voterToRemove = UUID.randomUUID();

        lenient().when(voterContext.getVoterId()).thenReturn(null);

        danceService().withdrawVoteAsVoter(danceId, trackId, voterToRemove);

        verify(voteRepository).deleteVote(danceId, trackId, voterToRemove);
    }
}
