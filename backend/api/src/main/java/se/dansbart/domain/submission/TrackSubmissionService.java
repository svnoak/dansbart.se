package se.dansbart.domain.submission;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.reputation.VoterReputationService;
import se.dansbart.domain.track.PlaybackLinkJooqRepository;
import se.dansbart.domain.track.TrackFeedbackService;
import se.dansbart.dto.TrackSubmissionBatchDto;
import se.dansbart.dto.TrackSubmissionDto;
import se.dansbart.dto.TrackSubmissionPageDto;
import se.dansbart.dto.request.ApproveSubmissionRequest;
import se.dansbart.exception.BadRequestException;
import se.dansbart.exception.ConflictException;
import se.dansbart.exception.ResourceNotFoundException;
import se.dansbart.mapper.TrackSubmissionMapper;
import se.dansbart.voter.VoterContext;
import se.dansbart.worker.TaskDispatcher;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * The "Lägg till musik" flow. A pasted link becomes one {@link TrackSubmission} per
 * track. Tracks the catalog already has are reported as such. The rest are ingested at
 * once when the submitter is a trusted contributor (see
 * {@link VoterReputationService#isTrustedContributor()}), otherwise they wait for an
 * admin, whose approval also rewards a signed-in submitter.
 *
 * Spotify tracks go through the existing ingest worker, so their track id is filled in
 * later, the first time the submission is read after the worker ran. YouTube videos
 * have no worker and are created here. Either way the suggested dance style, taken
 * from the admin-maintained style keywords, becomes the submitter's style vote.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TrackSubmissionService {

    /** The most tracks one link adds; an artist's whole discography can exceed it. */
    public static final int MAX_TRACKS_PER_LINK = 300;

    private final TrackSubmissionJooqRepository repository;
    private final PlaybackLinkJooqRepository playbackLinkRepository;
    private final SpotifySourceResolver spotifyResolver;
    private final YouTubeSourceResolver youtubeResolver;
    private final StyleSuggester styleSuggester;
    private final YouTubeTrackCreator youtubeTrackCreator;
    private final TaskDispatcher taskDispatcher;
    private final VoterReputationService reputationService;
    private final TrackFeedbackService trackFeedbackService;
    private final TrackSubmissionMapper mapper;
    private final VoterContext voterContext;

    @Transactional
    public TrackSubmissionBatchDto submit(String url) {
        MusicLink link = MusicLinkParser.parse(url)
            .orElseThrow(() -> new BadRequestException("The link is not a Spotify or YouTube track, album, artist, playlist or channel"));
        ResolvedSource source = switch (link.provider()) {
            case SPOTIFY -> spotifyResolver.resolve(link, MAX_TRACKS_PER_LINK);
            case YOUTUBE -> youtubeResolver.resolve(link);
        };
        if (source.tracks().isEmpty()) {
            throw new ResourceNotFoundException("No tracks found behind the link");
        }

        boolean trusted = reputationService.isTrustedContributor();
        UUID batchId = UUID.randomUUID();
        List<TrackSubmission> items = new ArrayList<>();
        for (SubmissionCandidate candidate : source.tracks()) {
            items.add(submitOne(batchId, source, candidate, trusted));
        }
        return toBatchDto(batchId, source.link(), source.sourceName(), source.truncated(), items);
    }

    private TrackSubmission submitOne(UUID batchId, ResolvedSource source, SubmissionCandidate c, boolean trusted) {
        TrackSubmission s = toSubmission(batchId, source, c);

        Optional<UUID> existing = findExisting(s);
        if (existing.isPresent()) {
            s.setStatus(TrackSubmission.STATUS_EXISTS);
            s.setTrackId(existing.get());
            return reload(repository.insert(s));
        }

        Optional<TrackSubmission> alreadyPending = repository.findPendingByExternalId(s.getProvider(), s.getExternalId());
        if (alreadyPending.isPresent()) {
            return alreadyPending.get();
        }

        if (trusted) {
            ingest(s);
            s.setStatus(TrackSubmission.STATUS_APPROVED);
            s.setReviewedBy(voterContext.getUserId());
            s.setReviewedAt(OffsetDateTime.now());
            repository.insert(s);
            castSubmitterVote(s);
            return reload(s);
        }

        s.setStatus(TrackSubmission.STATUS_PENDING);
        return reload(repository.insert(s));
    }

    private TrackSubmission toSubmission(UUID batchId, ResolvedSource source, SubmissionCandidate c) {
        Optional<StyleSuggester.Suggestion> style = styleSuggester.suggest(c.title(), c.albumName());
        return TrackSubmission.builder()
            .batchId(batchId)
            .voterId(voterContext.getVoterId())
            .userId(voterContext.getUserId())
            .provider(c.provider().dbValue())
            .sourceKind(source.link().kind().dbValue())
            .sourceUrl(source.link().url())
            .sourceName(source.sourceName())
            .externalId(c.externalId())
            .title(c.title() == null || c.title().isBlank() ? "(utan titel)" : c.title())
            .artistName(c.artistName())
            .albumName(c.albumName())
            .suggestedMainStyle(style.map(StyleSuggester.Suggestion::mainStyle).orElse(null))
            .suggestedSubStyle(style.map(StyleSuggester.Suggestion::subStyle).orElse(null))
            .build();
    }

    /** The public catalog track that already carries this provider id. */
    private Optional<UUID> findExisting(TrackSubmission s) {
        return playbackLinkRepository.findPublicTrackIdByPlatformAndDeepLink(s.getProvider(), s.getExternalId());
    }

    /** Spotify: the existing ingest worker. YouTube: created here, so the track id is known at once. */
    private void ingest(TrackSubmission s) {
        if (MusicLink.Provider.YOUTUBE.dbValue().equals(s.getProvider())) {
            s.setTrackId(youtubeTrackCreator.create(s));
        } else {
            taskDispatcher.dispatchSpotifyIngest("track", s.getExternalId());
        }
    }

    @Transactional
    public TrackSubmissionBatchDto getBatch(UUID batchId) {
        List<TrackSubmission> items = linkIngestedTracks(repository.findByBatchId(batchId));
        if (items.isEmpty()) {
            throw new ResourceNotFoundException("Submission batch", batchId);
        }
        TrackSubmission first = items.get(0);
        MusicLink link = new MusicLink(
            MusicLink.Provider.valueOf(first.getProvider().toUpperCase()),
            MusicLink.SourceKind.valueOf(first.getSourceKind().toUpperCase()),
            first.getExternalId(), first.getSourceUrl());
        return toBatchDto(batchId, link, first.getSourceName(), false, items);
    }

    @Transactional
    public TrackSubmissionPageDto listForAdmin(String status, int limit, int offset) {
        List<TrackSubmissionDto> items = linkIngestedTracks(repository.findPage(status, limit, offset)).stream()
            .map(s -> mapper.toDto(s, true))
            .toList();
        return TrackSubmissionPageDto.builder()
            .items(items)
            .total(repository.count(status))
            .limit(limit)
            .offset(offset)
            .build();
    }

    @Transactional(readOnly = true)
    public long countPending() {
        return repository.countPending();
    }

    @Transactional
    public TrackSubmissionDto approve(UUID id, UUID adminId, ApproveSubmissionRequest request) {
        TrackSubmission s = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Submission", id));
        if (!s.isPending()) {
            throw new ConflictException("Submission is already " + s.getStatus());
        }
        approvePending(s, adminId, request);
        return mapper.toDto(reload(s), true);
    }

    /** Approves every pending track from one link with its suggested style. */
    @Transactional
    public List<TrackSubmissionDto> approveBatch(UUID batchId, UUID adminId) {
        for (TrackSubmission s : repository.findPendingByBatchId(batchId)) {
            approvePending(s, adminId, null);
        }
        return repository.findByBatchId(batchId).stream().map(s -> mapper.toDto(s, true)).toList();
    }

    private void approvePending(TrackSubmission s, UUID adminId, ApproveSubmissionRequest request) {
        String mainStyle = s.getSuggestedMainStyle();
        String subStyle = s.getSuggestedSubStyle();
        if (request != null && (request.mainStyle() != null || request.subStyle() != null)) {
            mainStyle = blankToNull(request.mainStyle());
            subStyle = mainStyle == null ? null : blankToNull(request.subStyle());
        }
        s.setSuggestedMainStyle(mainStyle);
        s.setSuggestedSubStyle(subStyle);

        boolean firstApprovalInBatch = !repository.existsApprovedInBatch(s.getBatchId());

        Optional<UUID> existing = findExisting(s);
        if (existing.isPresent()) {
            s.setStatus(TrackSubmission.STATUS_EXISTS);
            s.setTrackId(existing.get());
            repository.markReviewed(s.getId(), s.getStatus(), s.getTrackId(), adminId, null, mainStyle, subStyle);
            return;
        }

        ingest(s);
        s.setStatus(TrackSubmission.STATUS_APPROVED);
        s.setReviewedBy(adminId);
        repository.markReviewed(s.getId(), s.getStatus(), s.getTrackId(), adminId, null, mainStyle, subStyle);
        castSubmitterVote(s);
        castReviewerVote(s);

        // One reward per link, not per track, so a 20-track album counts once.
        if (s.getUserId() != null && firstApprovalInBatch) {
            reputationService.rewardVoter(s.getUserId());
        }
    }

    @Transactional
    public TrackSubmissionDto reject(UUID id, UUID adminId, String reviewNote) {
        TrackSubmission s = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Submission", id));
        if (!s.isPending()) {
            throw new ConflictException("Submission is already " + s.getStatus());
        }
        repository.markReviewed(s.getId(), TrackSubmission.STATUS_REJECTED, null, adminId, blankToNull(reviewNote),
            s.getSuggestedMainStyle(), s.getSuggestedSubStyle());
        return mapper.toDto(reload(s), true);
    }

    /**
     * Approved Spotify rows get their track id the first time they are read after the
     * ingest worker created the track, and the style votes are cast then.
     */
    private List<TrackSubmission> linkIngestedTracks(List<TrackSubmission> items) {
        boolean linkedAny = false;
        for (TrackSubmission s : items) {
            if (!TrackSubmission.STATUS_APPROVED.equals(s.getStatus()) || s.getTrackId() != null) continue;
            Optional<UUID> trackId = findExisting(s);
            if (trackId.isEmpty()) continue;
            s.setTrackId(trackId.get());
            repository.updateTrackId(s.getId(), trackId.get());
            castSubmitterVote(s);
            castReviewerVote(s);
            linkedAny = true;
        }
        return linkedAny ? items.stream().map(this::reload).toList() : items;
    }

    /** The submitter's style vote, at their own weight, so a trusted person confirms the style alone. */
    private void castSubmitterVote(TrackSubmission s) {
        String style = votedStyle(s);
        if (style == null || s.getTrackId() == null || s.getVoterId() == null) return;
        trackFeedbackService.recordStyleVoteForVoter(
            s.getTrackId(), s.getVoterId(), reputationService.getWeightForVoter(s.getVoterId()), style);
    }

    /** The approving admin saw the style on the review page; their vote confirms it. */
    private void castReviewerVote(TrackSubmission s) {
        String style = votedStyle(s);
        UUID reviewer = s.getReviewedBy();
        if (style == null || s.getTrackId() == null || reviewer == null || reviewer.equals(s.getVoterId())) return;
        trackFeedbackService.recordStyleVoteForVoter(
            s.getTrackId(), reviewer, reputationService.getWeightForVoter(reviewer), style);
    }

    private static String votedStyle(TrackSubmission s) {
        if (s.getSuggestedSubStyle() != null && !s.getSuggestedSubStyle().isBlank()) return s.getSuggestedSubStyle();
        if (s.getSuggestedMainStyle() != null && !s.getSuggestedMainStyle().isBlank()) return s.getSuggestedMainStyle();
        return null;
    }

    private TrackSubmission reload(TrackSubmission s) {
        return repository.findById(s.getId()).orElse(s);
    }

    private TrackSubmissionBatchDto toBatchDto(UUID batchId, MusicLink link, String sourceName, boolean truncated,
                                               List<TrackSubmission> items) {
        List<TrackSubmissionDto> dtos = items.stream().map(s -> mapper.toDto(s, false)).toList();
        boolean needsReview = items.stream().anyMatch(TrackSubmission::isPending);
        return TrackSubmissionBatchDto.builder()
            .batchId(batchId)
            .provider(link.provider().dbValue())
            .sourceKind(link.kind().dbValue())
            .sourceName(sourceName)
            .needsReview(needsReview)
            .truncated(truncated)
            .items(dtos)
            .build();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
