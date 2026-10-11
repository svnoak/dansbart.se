package se.dansbart.domain.submission;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import se.dansbart.domain.reputation.VoterReputationService;
import se.dansbart.domain.submission.MusicLink.Provider;
import se.dansbart.domain.submission.MusicLink.SourceKind;
import se.dansbart.domain.track.PlaybackLinkJooqRepository;
import se.dansbart.domain.track.TrackFeedbackService;
import se.dansbart.dto.TrackSubmissionBatchDto;
import se.dansbart.dto.TrackSubmissionDto;
import se.dansbart.dto.request.ApproveSubmissionRequest;
import se.dansbart.exception.BadRequestException;
import se.dansbart.exception.ConflictException;
import se.dansbart.mapper.TrackSubmissionMapper;
import se.dansbart.voter.VoterContext;
import se.dansbart.worker.TaskDispatcher;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TrackSubmissionServiceTest {

    private static final String TRACK_URL = "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC";

    @Mock private TrackSubmissionJooqRepository repository;
    @Mock private PlaybackLinkJooqRepository playbackLinkRepository;
    @Mock private SpotifySourceResolver spotifyResolver;
    @Mock private YouTubeSourceResolver youtubeResolver;
    @Mock private StyleSuggester styleSuggester;
    @Mock private YouTubeTrackCreator youtubeTrackCreator;
    @Mock private TaskDispatcher taskDispatcher;
    @Mock private VoterReputationService reputationService;
    @Mock private TrackFeedbackService trackFeedbackService;
    @Mock private VoterContext voterContext;

    private TrackSubmissionService service;
    private final UUID voterId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new TrackSubmissionService(repository, playbackLinkRepository, spotifyResolver, youtubeResolver,
            styleSuggester, youtubeTrackCreator, taskDispatcher, reputationService, trackFeedbackService,
            new TrackSubmissionMapper(), voterContext);
        lenient().when(voterContext.getVoterId()).thenReturn(voterId);
        lenient().when(repository.insert(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(repository.findById(any())).thenReturn(Optional.empty());
        lenient().when(repository.findPendingByExternalId(anyString(), anyString())).thenReturn(Optional.empty());
        lenient().when(playbackLinkRepository.findPublicTrackIdByPlatformAndDeepLink(anyString(), anyString())).thenReturn(Optional.empty());
        lenient().when(styleSuggester.suggest(any(), any())).thenReturn(Optional.empty());
    }

    private void resolvesToOneTrack() {
        MusicLink link = new MusicLink(Provider.SPOTIFY, SourceKind.TRACK, "4uLU6hMCjMI75M1A2tKUQC", TRACK_URL);
        SubmissionCandidate candidate = new SubmissionCandidate(Provider.SPOTIFY, "4uLU6hMCjMI75M1A2tKUQC",
            "Polska efter Pekkos Per", "Väsen", "Trio");
        when(spotifyResolver.resolve(any(), eq(TrackSubmissionService.MAX_TRACKS_PER_LINK)))
            .thenReturn(new ResolvedSource(link, null, List.of(candidate), false));
    }

    @Test
    void unknownLink_isBadRequest() {
        assertThatThrownBy(() -> service.submit("https://example.com/x")).isInstanceOf(BadRequestException.class);
    }

    @Test
    void untrustedSubmitter_leavesTracksPendingWithSuggestedStyle() {
        resolvesToOneTrack();
        when(reputationService.isTrustedContributor()).thenReturn(false);
        when(styleSuggester.suggest("Polska efter Pekkos Per", "Trio"))
            .thenReturn(Optional.of(new StyleSuggester.Suggestion("Polska", null)));

        TrackSubmissionBatchDto batch = service.submit(TRACK_URL);

        assertThat(batch.isNeedsReview()).isTrue();
        assertThat(batch.getItems()).hasSize(1);
        TrackSubmissionDto item = batch.getItems().get(0);
        assertThat(item.getStatus()).isEqualTo("pending");
        assertThat(item.getSuggestedMainStyle()).isEqualTo("Polska");
        assertThat(item.getSubmitterName()).isNull();
        verify(taskDispatcher, never()).dispatchSpotifyIngest(any(), any());
    }

    @Test
    void trustedSubmitter_spotifyTrackGoesToTheIngestWorker() {
        resolvesToOneTrack();
        UUID userId = UUID.randomUUID();
        when(voterContext.getUserId()).thenReturn(userId);
        when(reputationService.isTrustedContributor()).thenReturn(true);
        when(styleSuggester.suggest(any(), any()))
            .thenReturn(Optional.of(new StyleSuggester.Suggestion("Polska", "Slängpolska")));

        TrackSubmissionBatchDto batch = service.submit(TRACK_URL);

        assertThat(batch.isNeedsReview()).isFalse();
        assertThat(batch.getItems().get(0).getStatus()).isEqualTo("approved");
        assertThat(batch.getItems().get(0).getTrackId()).isNull();
        verify(taskDispatcher).dispatchSpotifyIngest("track", "4uLU6hMCjMI75M1A2tKUQC");
        // The track does not exist yet, so the vote waits until the batch is read again.
        verify(trackFeedbackService, never()).recordStyleVoteForVoter(any(), any(), any(), any());
        verify(reputationService, never()).rewardVoter(any());
    }

    @Test
    void trustedSubmitter_youtubeVideoIsCreatedAndVotedAtOnce() {
        MusicLink link = new MusicLink(Provider.YOUTUBE, SourceKind.TRACK, "dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ");
        when(youtubeResolver.resolve(any())).thenReturn(new ResolvedSource(link, null,
            List.of(new SubmissionCandidate(Provider.YOUTUBE, "dQw4w9WgXcQ", "Hambo", "Väsen", null)), false));
        UUID trackId = UUID.randomUUID();
        when(reputationService.isTrustedContributor()).thenReturn(true);
        when(reputationService.getWeightForVoter(voterId)).thenReturn(new BigDecimal("2.1"));
        when(styleSuggester.suggest("Hambo", null)).thenReturn(Optional.of(new StyleSuggester.Suggestion("Hambo", null)));
        when(youtubeTrackCreator.create(any())).thenReturn(trackId);

        TrackSubmissionBatchDto batch = service.submit("https://youtu.be/dQw4w9WgXcQ");

        assertThat(batch.getItems().get(0).getStatus()).isEqualTo("approved");
        assertThat(batch.getItems().get(0).getTrackId()).isEqualTo(trackId);
        verify(trackFeedbackService).recordStyleVoteForVoter(trackId, voterId, new BigDecimal("2.1"), "Hambo");
        verify(taskDispatcher, never()).dispatchSpotifyIngest(any(), any());
    }

    @Test
    void readingABatch_linksTracksTheWorkerCreatedAndCastsTheVotes() {
        UUID batchId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        UUID trackId = UUID.randomUUID();
        TrackSubmission approved = TrackSubmission.builder().id(UUID.randomUUID()).batchId(batchId).voterId(voterId)
            .reviewedBy(adminId).provider("spotify").sourceKind("track").sourceUrl(TRACK_URL)
            .externalId("4uLU6hMCjMI75M1A2tKUQC").title("Polska").suggestedMainStyle("Polska").status("approved").build();
        when(repository.findByBatchId(batchId)).thenReturn(List.of(approved));
        when(repository.findById(approved.getId())).thenReturn(Optional.of(approved));
        when(playbackLinkRepository.findPublicTrackIdByPlatformAndDeepLink("spotify", "4uLU6hMCjMI75M1A2tKUQC"))
            .thenReturn(Optional.of(trackId));
        when(reputationService.getWeightForVoter(voterId)).thenReturn(new BigDecimal("0.3"));
        when(reputationService.getWeightForVoter(adminId)).thenReturn(new BigDecimal("3.0"));

        service.getBatch(batchId);

        verify(repository).updateTrackId(approved.getId(), trackId);
        verify(trackFeedbackService).recordStyleVoteForVoter(trackId, voterId, new BigDecimal("0.3"), "Polska");
        verify(trackFeedbackService).recordStyleVoteForVoter(trackId, adminId, new BigDecimal("3.0"), "Polska");
    }

    @Test
    void existingTrack_isReportedNotIngested() {
        resolvesToOneTrack();
        UUID trackId = UUID.randomUUID();
        when(reputationService.isTrustedContributor()).thenReturn(true);
        when(playbackLinkRepository.findPublicTrackIdByPlatformAndDeepLink("spotify", "4uLU6hMCjMI75M1A2tKUQC"))
            .thenReturn(Optional.of(trackId));

        TrackSubmissionBatchDto batch = service.submit(TRACK_URL);

        assertThat(batch.getItems().get(0).getStatus()).isEqualTo("exists");
        assertThat(batch.getItems().get(0).getTrackId()).isEqualTo(trackId);
        verify(taskDispatcher, never()).dispatchSpotifyIngest(any(), any());
    }

    @Test
    void trackAlreadyWaiting_reusesThePendingRow() {
        resolvesToOneTrack();
        when(reputationService.isTrustedContributor()).thenReturn(false);
        TrackSubmission waiting = TrackSubmission.builder().id(UUID.randomUUID()).batchId(UUID.randomUUID())
            .provider("spotify").externalId("4uLU6hMCjMI75M1A2tKUQC").title("Polska efter Pekkos Per")
            .status("pending").build();
        when(repository.findPendingByExternalId("spotify", "4uLU6hMCjMI75M1A2tKUQC")).thenReturn(Optional.of(waiting));

        TrackSubmissionBatchDto batch = service.submit(TRACK_URL);

        assertThat(batch.getItems().get(0).getId()).isEqualTo(waiting.getId());
        verify(repository, never()).insert(any());
    }

    @Test
    void adminApproval_createsTrackCastsVotesAndRewardsOncePerBatch() {
        UUID id = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        UUID trackId = UUID.randomUUID();
        TrackSubmission pending = TrackSubmission.builder().id(id).batchId(batchId).voterId(userId).userId(userId)
            .provider("youtube").externalId("dQw4w9WgXcQ").title("Hambo").suggestedMainStyle("Hambo")
            .status("pending").build();
        when(repository.findById(id)).thenReturn(Optional.of(pending));
        when(repository.existsApprovedInBatch(batchId)).thenReturn(false);
        when(youtubeTrackCreator.create(any())).thenReturn(trackId);
        when(reputationService.getWeightForVoter(userId)).thenReturn(new BigDecimal("2.0"));
        when(reputationService.getWeightForVoter(adminId)).thenReturn(new BigDecimal("3.0"));

        service.approve(id, adminId, null);

        verify(repository).markReviewed(id, "approved", trackId, adminId, null, "Hambo", null);
        verify(trackFeedbackService).recordStyleVoteForVoter(trackId, userId, new BigDecimal("2.0"), "Hambo");
        verify(trackFeedbackService).recordStyleVoteForVoter(trackId, adminId, new BigDecimal("3.0"), "Hambo");
        verify(reputationService).rewardVoter(userId);
    }

    @Test
    void adminApproval_ofASpotifyTrack_dispatchesTheIngestWorker() {
        UUID id = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        TrackSubmission pending = TrackSubmission.builder().id(id).batchId(UUID.randomUUID()).voterId(UUID.randomUUID())
            .provider("spotify").externalId("abc").title("Låt").suggestedMainStyle("Polska").status("pending").build();
        when(repository.findById(id)).thenReturn(Optional.of(pending));
        when(repository.existsApprovedInBatch(any())).thenReturn(true);

        service.approve(id, adminId, null);

        verify(taskDispatcher).dispatchSpotifyIngest("track", "abc");
        verify(repository).markReviewed(id, "approved", null, adminId, null, "Polska", null);
        verify(trackFeedbackService, never()).recordStyleVoteForVoter(any(), any(), any(), any());
    }

    @Test
    void adminApproval_withChangedStyle_usesThatStyle() {
        UUID id = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        UUID voter = UUID.randomUUID();
        UUID trackId = UUID.randomUUID();
        TrackSubmission pending = TrackSubmission.builder().id(id).batchId(UUID.randomUUID()).voterId(voter)
            .provider("youtube").externalId("abcdefghijk").title("Låt").suggestedMainStyle("Polska").status("pending").build();
        when(repository.findById(id)).thenReturn(Optional.of(pending));
        when(repository.existsApprovedInBatch(any())).thenReturn(true);
        when(youtubeTrackCreator.create(any())).thenReturn(trackId);
        when(reputationService.getWeightForVoter(any())).thenReturn(new BigDecimal("0.3"));

        service.approve(id, adminId, new ApproveSubmissionRequest("Vals", null));

        verify(repository).markReviewed(id, "approved", trackId, adminId, null, "Vals", null);
        verify(trackFeedbackService).recordStyleVoteForVoter(trackId, voter, new BigDecimal("0.3"), "Vals");
        verify(trackFeedbackService).recordStyleVoteForVoter(trackId, adminId, new BigDecimal("0.3"), "Vals");
        verify(reputationService, never()).rewardVoter(any());
    }

    @Test
    void adminApproval_withClearedStyle_castsNoVote() {
        UUID id = UUID.randomUUID();
        TrackSubmission pending = TrackSubmission.builder().id(id).batchId(UUID.randomUUID()).voterId(UUID.randomUUID())
            .provider("youtube").externalId("abcdefghijk").title("Låt").suggestedMainStyle("Polska").status("pending").build();
        when(repository.findById(id)).thenReturn(Optional.of(pending));
        when(youtubeTrackCreator.create(any())).thenReturn(UUID.randomUUID());

        service.approve(id, UUID.randomUUID(), new ApproveSubmissionRequest("", null));

        verify(trackFeedbackService, never()).recordStyleVoteForVoter(any(), any(), any(), any());
    }

    @Test
    void approvingTwice_isAConflict() {
        UUID id = UUID.randomUUID();
        TrackSubmission done = TrackSubmission.builder().id(id).status("approved").build();
        when(repository.findById(id)).thenReturn(Optional.of(done));

        assertThatThrownBy(() -> service.approve(id, UUID.randomUUID(), null)).isInstanceOf(ConflictException.class);
    }

    @Test
    void reject_marksTheRowWithTheNote() {
        UUID id = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        TrackSubmission pending = TrackSubmission.builder().id(id).status("pending").suggestedMainStyle("Polska").build();
        when(repository.findById(id)).thenReturn(Optional.of(pending));

        service.reject(id, adminId, "Inte folkmusik");

        verify(repository).markReviewed(id, "rejected", null, adminId, "Inte folkmusik", "Polska", null);
        verify(youtubeTrackCreator, never()).create(any());
        verify(taskDispatcher, never()).dispatchSpotifyIngest(any(), any());
    }
}
