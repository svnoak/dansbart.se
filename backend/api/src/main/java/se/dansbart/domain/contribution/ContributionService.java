package se.dansbart.domain.contribution;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import se.dansbart.domain.admin.StyleKeywordJooqRepository;
import se.dansbart.domain.track.BpmMultiplierResolver;
import se.dansbart.domain.track.LinkedTrackCreator;
import se.dansbart.domain.track.PlaybackLinkJooqRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackDanceStyle;
import se.dansbart.domain.track.TrackDanceStyleJooqRepository;
import se.dansbart.domain.track.TrackFeedbackService;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.domain.user.UserJooqRepository;
import se.dansbart.dto.ContributedStyleDto;
import se.dansbart.dto.LinkPreviewDto;
import se.dansbart.dto.TrackSubmissionResultDto;
import se.dansbart.dto.request.DanceStyleCreateRequest;
import se.dansbart.dto.request.TrackSubmissionRequest;
import se.dansbart.exception.BadRequestException;
import se.dansbart.exception.ConflictException;
import se.dansbart.exception.ForbiddenException;
import se.dansbart.exception.UnprocessableEntityException;
import se.dansbart.voter.VoterContext;
import se.dansbart.worker.TaskDispatcher;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Lets signed-in users add tracks and dance styles to the public library.
 *
 * Both a YouTube and a Spotify link create the track here, at once, and start the audio
 * analysis. The analysis downloads the YouTube video, or for a Spotify link searches
 * YouTube by artist and title. Adding never waits for a worker or for Spotify: when the
 * Spotify lookup fails, the title the person typed is enough. {@link TrackSubmissionResolverJob}
 * puts the submitter's style back as primary once the analysis is done.
 *
 * The submitter's dance style is stored as a user-confirmed style, which the classifier
 * never overwrites. Additions are public at once; admins look at them afterwards.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ContributionService {

    static final int MAX_TRACKS_PER_DAY = 30;
    static final int MAX_STYLES_PER_DAY = 5;
    static final int MAX_NAME_LENGTH = 200;
    static final int MAX_STYLE_NAME_LENGTH = 40;

    /** Same labels as the tempo picker in the frontend. */
    static final Set<String> TEMPO_CATEGORIES = Set.of("Långsamt", "Lugnt", "Lagom", "Snabbt", "Väldigt snabbt");

    /** Letters (any script), digits, spaces, hyphens and apostrophes. */
    private static final Pattern STYLE_NAME = Pattern.compile("^[\\p{L}\\p{N}][\\p{L}\\p{N} '\\-]*$");

    private final VoterContext voterContext;
    private final UserJooqRepository userRepository;
    private final TrackSubmissionJooqRepository submissionRepository;
    private final TrackJooqRepository trackRepository;
    private final PlaybackLinkJooqRepository playbackLinkRepository;
    private final LinkedTrackCreator linkedTrackCreator;
    private final TrackDanceStyleJooqRepository danceStyleRepository;
    private final StyleKeywordJooqRepository styleKeywordRepository;
    private final TrackFeedbackService feedbackService;
    private final LinkMetadataService linkMetadataService;
    private final TaskDispatcher taskDispatcher;

    // ---------------------------------------------------------------- tracks

    @Transactional(readOnly = true)
    public LinkPreviewDto previewLink(String url) {
        requireContributor();
        TrackLinkParser.ParsedLink link = parseOrThrow(url);
        Optional<UUID> existing = findExistingTrack(link);
        if (existing.isPresent()) {
            String title = trackRepository.findById(existing.get()).map(Track::getTitle).orElse(null);
            return new LinkPreviewDto(link.source().name(), link.externalId(), null, null, null, existing.get(), title);
        }
        LinkMetadataService.LinkMetadata meta = lookupOrThrow(link);
        return new LinkPreviewDto(link.source().name(), link.externalId(),
            meta.title(), meta.artistName(), meta.durationMs(), null, null);
    }

    @Transactional
    public TrackSubmissionResultDto submitTrack(TrackSubmissionRequest request) {
        UUID userId = requireContributor();
        TrackLinkParser.ParsedLink link = parseOrThrow(request.url());
        StyleChoice style = resolveStyleChoice(request.mainStyle(), request.subStyle());
        String tempo = blankToNull(request.tempoCategory());
        if (tempo != null && !TEMPO_CATEGORIES.contains(tempo)) {
            throw new BadRequestException("Okänd tempokategori.");
        }

        // A track the library already has gets the chosen style as an ordinary vote.
        Optional<UUID> existing = findExistingTrack(link);
        if (existing.isPresent()) {
            feedbackService.submitStyleFeedback(existing.get(), style.voteValue(), tempo);
            return new TrackSubmissionResultDto(null, existing.get(), "EXISTS");
        }

        boolean admin = "ADMIN".equals(userRepository.findRoleById(userId));
        if (!admin && submissionRepository.countByUserSince(userId, OffsetDateTime.now().minusDays(1)) >= MAX_TRACKS_PER_DAY) {
            throw new UnprocessableEntityException("Du har lagt till många låtar i dag. Försök igen i morgon.");
        }

        LinkMetadataService.LinkMetadata meta = lookupOrThrow(link);
        String title = firstNonBlank(request.title(), meta.title());
        String artistName = firstNonBlank(request.artistName(), meta.artistName());
        if (title == null) {
            throw new BadRequestException("Ange låtens titel.");
        }
        title = limit(title, MAX_NAME_LENGTH);
        artistName = artistName != null ? limit(artistName, MAX_NAME_LENGTH) : null;
        // An admin's own additions need no review.
        OffsetDateTime reviewedAt = admin ? OffsetDateTime.now() : null;

        UUID trackId = createTrack(link, title, artistName, meta, userId);
        TrackSubmission submission = submissionRepository.insert(new TrackSubmission(
            null, userId, link.source().name(), link.externalId(), title, artistName,
            style.mainStyle(), style.subStyle(), tempo, trackId, true, TrackSubmission.LINKED, null, null),
            reviewedAt);
        applySubmitterStyle(submission, trackId, true);
        afterCommit(() -> taskDispatcher.dispatchAudioAnalysis(trackId));
        return new TrackSubmissionResultDto(submission.id(), trackId, "CREATED");
    }

    private UUID createTrack(TrackLinkParser.ParsedLink link, String title, String artistName,
                             LinkMetadataService.LinkMetadata meta, UUID userId) {
        return linkedTrackCreator.create(link.source().name().toLowerCase(), link.externalId(),
            title, artistName, meta.durationMs(), meta.isrc(), userId);
    }

    /**
     * Stores the submitter's style on the track as user-confirmed. The classifier keeps
     * user-confirmed rows. On a track the submission created, the style is also made the
     * primary one, because the classifier may have marked another style primary.
     */
    void applySubmitterStyle(TrackSubmission submission, UUID trackId, boolean makePrimary) {
        Float rawBpm = trackRepository.findById(trackId).map(Track::getTempoBpm).orElse(null);
        BpmMultiplierResolver.Result bpm = BpmMultiplierResolver.resolve(submission.danceStyle(), rawBpm);

        TrackDanceStyle row = danceStyleRepository.findFirstByTrackIdAndDanceStyle(trackId, submission.danceStyle())
            .orElseGet(() -> {
                TrackDanceStyle created = new TrackDanceStyle();
                created.setTrackId(trackId);
                created.setDanceStyle(submission.danceStyle());
                created.setIsPrimary(false);
                created.setConfirmationCount(0);
                return created;
            });
        if (submission.subStyle() != null) row.setSubStyle(submission.subStyle());
        if (submission.tempoCategory() != null) row.setTempoCategory(submission.tempoCategory());
        row.setConfidence(1.0f);
        row.setBpmMultiplier(bpm.multiplier());
        row.setEffectiveBpm(bpm.effectiveBpm());
        row.setIsUserConfirmed(true);
        row.setSource("user_submission");
        if (makePrimary) row.setIsPrimary(true);
        TrackDanceStyle saved = danceStyleRepository.save(row);
        if (makePrimary) {
            danceStyleRepository.makeOnlyPrimary(trackId, saved.getId());
        }
    }

    // ---------------------------------------------------------------- styles

    @Transactional
    public ContributedStyleDto createStyle(DanceStyleCreateRequest request) {
        UUID userId = requireContributor();
        String name = normalizeStyleName(request.name());
        if (name == null) {
            throw new BadRequestException("Ange ett namn på dansstilen.");
        }
        if (name.length() > MAX_STYLE_NAME_LENGTH || !STYLE_NAME.matcher(name).matches()) {
            throw new BadRequestException("Namnet får bara innehålla bokstäver, siffror, mellanslag och bindestreck.");
        }

        String parent = normalizeStyleName(request.parentStyle());
        String mainStyle;
        String subStyle;
        if (parent == null) {
            if (styleKeywordRepository.existsByMainStyleOrSubStyle(name)) {
                throw new ConflictException("Dansstilen " + name + " finns redan.");
            }
            mainStyle = name;
            subStyle = null;
        } else {
            mainStyle = styleKeywordRepository.findMainStyleIgnoreCase(parent)
                .orElseThrow(() -> new BadRequestException("Huvudstilen " + parent + " finns inte."));
            if (name.equalsIgnoreCase(mainStyle)
                    || styleKeywordRepository.findSubStyleIgnoreCase(mainStyle, name).isPresent()) {
                throw new ConflictException(name + " finns redan under " + mainStyle + ".");
            }
            subStyle = name;
        }
        // The keyword column is unique across all styles.
        if (styleKeywordRepository.existsByKeywordIgnoreCase(name)) {
            throw new ConflictException("Namnet " + name + " används redan av en annan dansstil.");
        }

        boolean admin = "ADMIN".equals(userRepository.findRoleById(userId));
        if (!admin && styleKeywordRepository.countCreatedBySince(userId, OffsetDateTime.now().minusDays(1)) >= MAX_STYLES_PER_DAY) {
            throw new UnprocessableEntityException("Du har lagt till många dansstilar i dag. Försök igen i morgon.");
        }

        UUID id = styleKeywordRepository.insertContributed(
            name.toLowerCase(), mainStyle, subStyle, userId, admin ? OffsetDateTime.now() : null);
        return new ContributedStyleDto(id, mainStyle, subStyle);
    }

    // ---------------------------------------------------------------- helpers

    /** @return the signed-in, non-banned user's id */
    private UUID requireContributor() {
        UUID userId = voterContext.getUserId();
        if (userId == null) {
            throw new ForbiddenException("Logga in för att lägga till i biblioteket.");
        }
        if (userRepository.isBanned(userId)) {
            throw new ForbiddenException("Ditt konto kan inte lägga till i biblioteket.");
        }
        return userId;
    }

    private TrackLinkParser.ParsedLink parseOrThrow(String url) {
        return TrackLinkParser.parse(url).orElseThrow(() ->
            new BadRequestException("Klistra in en länk till en låt på YouTube eller Spotify."));
    }

    private LinkMetadataService.LinkMetadata lookupOrThrow(TrackLinkParser.ParsedLink link) {
        try {
            return linkMetadataService.lookup(link);
        } catch (LinkMetadataService.UnplayableLinkException e) {
            throw new UnprocessableEntityException(e.getMessage());
        }
    }

    private Optional<UUID> findExistingTrack(TrackLinkParser.ParsedLink link) {
        return playbackLinkRepository.findTrackIdByPlatformAndExternalId(
            link.source().name().toLowerCase(), link.externalId());
    }

    /** A main style, optionally with one of its sub-styles, in their stored spelling. */
    record StyleChoice(String mainStyle, String subStyle) {
        /** The style panel votes with the sub-style's name when one is chosen. */
        String voteValue() {
            return subStyle != null ? subStyle : mainStyle;
        }
    }

    private StyleChoice resolveStyleChoice(String mainStyle, String subStyle) {
        String main = blankToNull(mainStyle);
        if (main == null) {
            throw new BadRequestException("Välj en dansstil.");
        }
        String storedMain = styleKeywordRepository.findMainStyleIgnoreCase(main)
            .orElseThrow(() -> new BadRequestException("Dansstilen " + main + " finns inte."));
        String sub = blankToNull(subStyle);
        if (sub == null || sub.equalsIgnoreCase(storedMain)) {
            return new StyleChoice(storedMain, null);
        }
        String storedSub = styleKeywordRepository.findSubStyleIgnoreCase(storedMain, sub)
            .orElseThrow(() -> new BadRequestException(sub + " finns inte under " + storedMain + "."));
        return new StyleChoice(storedMain, storedSub);
    }

    /** Trims, collapses inner whitespace and capitalises the first letter. */
    static String normalizeStyleName(String raw) {
        String s = blankToNull(raw);
        if (s == null) return null;
        s = s.replaceAll("\\s+", " ");
        return s.substring(0, 1).toUpperCase() + s.substring(1);
    }

    private static void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String firstNonBlank(String a, String b) {
        String first = blankToNull(a);
        return first != null ? first : blankToNull(b);
    }

    private static String limit(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }
}
