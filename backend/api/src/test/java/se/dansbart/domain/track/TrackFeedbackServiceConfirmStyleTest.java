package se.dansbart.domain.track;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import se.dansbart.domain.admin.DanceMovementFeedbackJooqRepository;
import se.dansbart.domain.reputation.VoterReputationService;
import se.dansbart.voter.VoterContext;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Confirming a style must leave the track findable by tempo search: both the
 * new-row and the flip-to-confirmed branch of confirmStyleIfNeeded persist a
 * bpmMultiplier/effectiveBpm derived from the track's raw tempo_bpm.
 */
@ExtendWith(MockitoExtension.class)
class TrackFeedbackServiceConfirmStyleTest {

    @Mock
    private TrackStyleVoteJooqRepository voteRepository;

    @Mock
    private TrackJooqRepository trackJooqRepository;

    @Mock
    private TrackDanceStyleJooqRepository danceStyleRepository;

    @Mock
    private TrackStructureVersionJooqRepository structureVersionRepository;

    @Mock
    private DanceMovementFeedbackJooqRepository movementFeedbackRepository;

    @Mock
    private TrackSecondaryStyleConfirmationRepository secondaryConfirmationRepository;

    @Mock
    private VoterReputationService reputationService;

    @Mock
    private VoterContext voterContext;

    private TrackFeedbackService service() {
        return new TrackFeedbackService(
            voteRepository, trackJooqRepository, danceStyleRepository,
            structureVersionRepository, movementFeedbackRepository,
            secondaryConfirmationRepository, reputationService, voterContext);
    }

    private void stubConfirmingVote(UUID trackId) {
        UUID voterId = UUID.randomUUID();
        lenient().when(voterContext.getVoterId()).thenReturn(voterId);
        lenient().when(trackJooqRepository.existsById(trackId)).thenReturn(true);
        lenient().when(reputationService.getWeightForCurrentVoter()).thenReturn(BigDecimal.ONE);
        lenient().when(voteRepository.weightedSumByTrackIdAndSuggestedStyle(trackId, "Hambo"))
            .thenReturn(VoterReputationService.CONFIRMATION_THRESHOLD);
        lenient().when(voteRepository.findByTrackIdAndVoterId(trackId, voterId)).thenReturn(Optional.empty());
        lenient().when(voteRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void confirmingStyleWithNoExistingRow_persistsNonZeroEffectiveBpm() {
        UUID trackId = UUID.randomUUID();
        stubConfirmingVote(trackId);
        when(danceStyleRepository.findByTrackIdAndDanceStyle(trackId, "Hambo")).thenReturn(Optional.empty());
        when(trackJooqRepository.findById(trackId)).thenReturn(Optional.of(Track.builder().id(trackId).tempoBpm(161f).build()));

        Optional<TrackFeedbackService.StyleFeedbackResult> result =
            service().submitStyleFeedback(trackId, "Hambo", null);

        assertTrue(result.get().styleJustConfirmed());
        ArgumentCaptor<TrackDanceStyle> captor = ArgumentCaptor.forClass(TrackDanceStyle.class);
        verify(danceStyleRepository).save(captor.capture());
        TrackDanceStyle saved = captor.getValue();
        assertEquals(0.333f, saved.getBpmMultiplier(), 0.0001f);
        assertEquals(53, saved.getEffectiveBpm());
        assertTrue(saved.getIsUserConfirmed());
    }

    @Test
    void confirmingStyleOnExistingRow_persistsNonZeroEffectiveBpm() {
        UUID trackId = UUID.randomUUID();
        stubConfirmingVote(trackId);
        TrackDanceStyle existing = TrackDanceStyle.builder()
            .id(UUID.randomUUID())
            .trackId(trackId)
            .danceStyle("Hambo")
            .bpmMultiplier(1.0f)
            .effectiveBpm(0)
            .isUserConfirmed(false)
            .build();
        when(danceStyleRepository.findByTrackIdAndDanceStyle(trackId, "Hambo")).thenReturn(Optional.of(existing));
        when(trackJooqRepository.findById(trackId)).thenReturn(Optional.of(Track.builder().id(trackId).tempoBpm(161f).build()));

        Optional<TrackFeedbackService.StyleFeedbackResult> result =
            service().submitStyleFeedback(trackId, "Hambo", null);

        assertTrue(result.get().styleJustConfirmed());
        ArgumentCaptor<TrackDanceStyle> captor = ArgumentCaptor.forClass(TrackDanceStyle.class);
        verify(danceStyleRepository).save(captor.capture());
        TrackDanceStyle saved = captor.getValue();
        assertEquals(0.333f, saved.getBpmMultiplier(), 0.0001f);
        assertEquals(53, saved.getEffectiveBpm());
        assertTrue(saved.getIsUserConfirmed());
    }
}
