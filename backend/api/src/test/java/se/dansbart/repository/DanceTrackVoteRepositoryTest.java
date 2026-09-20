package se.dansbart.repository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import se.dansbart.domain.dance.Dance;
import se.dansbart.domain.dance.DanceJooqRepository;
import se.dansbart.domain.dance.DanceTrackVoteRepository;
import se.dansbart.domain.reputation.VoterReputationService;
import se.dansbart.domain.track.Track;
import se.dansbart.e2e.fixture.TestDataFactory;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for DanceTrackVoteRepository's weighted-vote thresholds.
 */
class DanceTrackVoteRepositoryTest extends AbstractRepositoryTest {

    @Autowired
    private DanceTrackVoteRepository danceTrackVoteRepository;

    @Autowired
    private DanceJooqRepository danceJooqRepository;

    @Autowired
    private TestDataFactory testData;

    private UUID createDance() {
        String slug = "test-dance-" + UUID.randomUUID();
        danceJooqRepository.upsertDances(List.of(Dance.builder().name("Test Dance").slug(slug).build()));
        return danceJooqRepository.findBySlug(slug).orElseThrow().getId();
    }

    @Test
    void singleAnonymousUpvoteMakesTrackMatch() {
        UUID danceId = createDance();
        Track track = testData.track().build();

        danceTrackVoteRepository.upsertVote(
                danceId, track.getId(), UUID.randomUUID(), 1, VoterReputationService.ANONYMOUS_WEIGHT);
        flush();

        assertThat(danceTrackVoteRepository.findMatchingTrackIds(danceId)).contains(track.getId());
    }

    @Test
    void twoAnonymousDownvotesSuppressTrackButOneDoesNot() {
        UUID danceId = createDance();
        Track belowThreshold = testData.track().build();
        Track atThreshold = testData.track().build();

        danceTrackVoteRepository.upsertVote(
                danceId, belowThreshold.getId(), UUID.randomUUID(), -1, VoterReputationService.ANONYMOUS_WEIGHT);
        danceTrackVoteRepository.upsertVote(
                danceId, atThreshold.getId(), UUID.randomUUID(), -1, VoterReputationService.ANONYMOUS_WEIGHT);
        danceTrackVoteRepository.upsertVote(
                danceId, atThreshold.getId(), UUID.randomUUID(), -1, VoterReputationService.ANONYMOUS_WEIGHT);
        flush();

        List<UUID> suppressed = danceTrackVoteRepository.findSuppressedTrackIds(danceId);

        assertThat(suppressed).doesNotContain(belowThreshold.getId());
        assertThat(suppressed).contains(atThreshold.getId());
    }
}
