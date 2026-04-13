package se.dansbart.domain.analytics;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.sum;
import static org.jooq.impl.DSL.when;
import static se.dansbart.jooq.Tables.TRACK_PLAYBACKS;

@Repository
public class TrackPlaybackJooqRepository {

    private final DSLContext dsl;

    public TrackPlaybackJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public TrackPlayback insert(TrackPlayback playback) {
        UUID id = playback.getId() != null ? playback.getId() : UUID.randomUUID();
        dsl.insertInto(TRACK_PLAYBACKS)
            .columns(
                TRACK_PLAYBACKS.ID,
                TRACK_PLAYBACKS.TRACK_ID,
                TRACK_PLAYBACKS.PLATFORM,
                TRACK_PLAYBACKS.DURATION_SECONDS,
                TRACK_PLAYBACKS.COMPLETED,
                TRACK_PLAYBACKS.SESSION_ID
            )
            .values(
                id,
                playback.getTrackId(),
                playback.getPlatform(),
                playback.getDurationSeconds(),
                playback.getCompleted(),
                playback.getSessionId()
            )
            .execute();
        playback.setId(id);
        return playback;
    }

    /**
     * Returns [trackId, playCount, completionRate, totalDurationSeconds] for most played tracks since a time.
     */
    public List<Object[]> findMostPlayedTracks(OffsetDateTime since, int limit) {
        var c = TRACK_PLAYBACKS.COMPLETED;
        var playCount = count(TRACK_PLAYBACKS.ID).as("play_count");
        var completionRate = sum(when(c.eq(true), 1).otherwise(0)).mul(100.0).div(count(TRACK_PLAYBACKS.ID)).as("completion_rate");
        var totalDuration = sum(TRACK_PLAYBACKS.DURATION_SECONDS).as("total_duration");
        var query = dsl.select(TRACK_PLAYBACKS.TRACK_ID, playCount, completionRate, totalDuration)
            .from(TRACK_PLAYBACKS)
            .where(since == null ? DSL.noCondition() : TRACK_PLAYBACKS.PLAYED_AT.ge(since))
            .groupBy(TRACK_PLAYBACKS.TRACK_ID)
            .orderBy(playCount.desc())
            .limit(limit);
        return query.fetch().map(r -> new Object[]{
            r.get(TRACK_PLAYBACKS.TRACK_ID),
            r.get("play_count", Long.class),
            r.get("completion_rate", Double.class),
            r.get("total_duration", Long.class)
        });
    }

    /** Sum of duration_seconds since the given time (or all time if since is null). */
    public Long sumDurationSeconds(OffsetDateTime since) {
        return dsl.select(sum(TRACK_PLAYBACKS.DURATION_SECONDS))
            .from(TRACK_PLAYBACKS)
            .where(since == null ? DSL.noCondition() : TRACK_PLAYBACKS.PLAYED_AT.ge(since))
            .fetchOne(0, Long.class);
    }

    /**
     * Returns [platform, playCount, totalDuration] since the given time (or all time if since is null).
     */
    public List<Object[]> countByPlatform(OffsetDateTime since) {
        return dsl.select(
                TRACK_PLAYBACKS.PLATFORM,
                count(TRACK_PLAYBACKS.ID).as("play_count"),
                sum(TRACK_PLAYBACKS.DURATION_SECONDS).as("total_duration")
            )
            .from(TRACK_PLAYBACKS)
            .where(since == null ? DSL.noCondition() : TRACK_PLAYBACKS.PLAYED_AT.ge(since))
            .groupBy(TRACK_PLAYBACKS.PLATFORM)
            .orderBy(DSL.field("play_count").desc())
            .fetch(r -> new Object[]{
                r.get(TRACK_PLAYBACKS.PLATFORM),
                r.get("play_count", Long.class),
                r.get("total_duration", Long.class)
            });
    }
}
