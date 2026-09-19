package se.dansbart.repository;

import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackDanceStyle;
import se.dansbart.domain.track.TrackDanceStyleJooqRepository;
import se.dansbart.domain.track.TrackJooqRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static se.dansbart.jooq.Tables.TRACKS;

/**
 * Tests for TrackDanceStyleJooqRepository.backfillEffectiveBpm.
 */
class TrackDanceStyleJooqRepositoryBackfillTest extends AbstractRepositoryTest {

    @Autowired
    private TrackDanceStyleJooqRepository trackDanceStyleJooqRepository;

    @Autowired
    private TrackJooqRepository trackJooqRepository;

    @Autowired
    private DSLContext dsl;

    private Track trackWithTempo(float tempoBpm) {
        Track track = trackJooqRepository.insert(Track.builder().title("Backfill Test Track").build());
        dsl.update(TRACKS).set(TRACKS.TEMPO_BPM, (double) tempoBpm).where(TRACKS.ID.eq(track.getId())).execute();
        return track;
    }

    @Test
    void updatesRowStuckAtZeroEffectiveBpm() {
        Track track = trackWithTempo(161f);
        TrackDanceStyle style = trackDanceStyleJooqRepository.save(TrackDanceStyle.builder()
            .trackId(track.getId())
            .danceStyle("Hambo")
            .bpmMultiplier(1.0f)
            .effectiveBpm(0)
            .build());
        flush();

        int updated = trackDanceStyleJooqRepository.backfillEffectiveBpm();

        assertThat(updated).isEqualTo(1);
        TrackDanceStyle result = trackDanceStyleJooqRepository.findByTrackIdAndDanceStyle(track.getId(), "Hambo").get();
        assertThat(result.getEffectiveBpm()).isEqualTo(53);
        assertThat(result.getBpmMultiplier()).isEqualTo(0.333f);
    }

    @Test
    void leavesRowWithExistingEffectiveBpmUnchanged() {
        Track track = trackWithTempo(161f);
        TrackDanceStyle style = trackDanceStyleJooqRepository.save(TrackDanceStyle.builder()
            .trackId(track.getId())
            .danceStyle("Hambo")
            .bpmMultiplier(1.0f)
            .effectiveBpm(140)
            .build());
        flush();

        int updated = trackDanceStyleJooqRepository.backfillEffectiveBpm();

        assertThat(updated).isEqualTo(0);
        TrackDanceStyle result = trackDanceStyleJooqRepository.findByTrackIdAndDanceStyle(track.getId(), "Hambo").get();
        assertThat(result.getEffectiveBpm()).isEqualTo(140);
        assertThat(result.getBpmMultiplier()).isEqualTo(1.0f);
    }
}
