package se.dansbart.domain.track;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.jooq.impl.DSL.countDistinct;
import static se.dansbart.jooq.Tables.TRACK_DANCE_STYLES;

@Repository
public class TrackDanceStyleJooqRepository {

    private final DSLContext dsl;

    public TrackDanceStyleJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public List<TrackDanceStyle> findByTrackId(UUID trackId) {
        return dsl.selectFrom(TRACK_DANCE_STYLES)
            .where(TRACK_DANCE_STYLES.TRACK_ID.eq(trackId))
            .orderBy(TRACK_DANCE_STYLES.IS_PRIMARY.desc(), TRACK_DANCE_STYLES.CONFIDENCE.desc())
            .fetch(this::toDanceStyle);
    }

    public Optional<TrackDanceStyle> findByTrackIdAndDanceStyle(UUID trackId, String danceStyle) {
        return dsl.selectFrom(TRACK_DANCE_STYLES)
            .where(TRACK_DANCE_STYLES.TRACK_ID.eq(trackId)
                .and(TRACK_DANCE_STYLES.DANCE_STYLE.eq(danceStyle)))
            .fetchOptional(this::toDanceStyle);
    }

    public Optional<TrackDanceStyle> findByTrackIdAndIsPrimaryTrue(UUID trackId) {
        return dsl.selectFrom(TRACK_DANCE_STYLES)
            .where(TRACK_DANCE_STYLES.TRACK_ID.eq(trackId)
                .and(TRACK_DANCE_STYLES.IS_PRIMARY.eq(true)))
            .fetchOptional(this::toDanceStyle);
    }

    public void setUserConfirmed(UUID trackId, String danceStyle, boolean confirmed) {
        dsl.update(TRACK_DANCE_STYLES)
            .set(TRACK_DANCE_STYLES.IS_USER_CONFIRMED, confirmed)
            .where(TRACK_DANCE_STYLES.TRACK_ID.eq(trackId)
                .and(TRACK_DANCE_STYLES.DANCE_STYLE.eq(danceStyle)))
            .execute();
    }

    public List<String> findAllDistinctDanceStyles() {
        return dsl.selectDistinct(TRACK_DANCE_STYLES.DANCE_STYLE)
            .from(TRACK_DANCE_STYLES)
            .where(TRACK_DANCE_STYLES.DANCE_STYLE.isNotNull())
            .orderBy(TRACK_DANCE_STYLES.DANCE_STYLE.asc())
            .fetch(TRACK_DANCE_STYLES.DANCE_STYLE);
    }

    public TrackDanceStyle save(TrackDanceStyle style) {
        if (style.getId() == null) {
            UUID id = UUID.randomUUID();
            dsl.insertInto(TRACK_DANCE_STYLES)
                .columns(
                    TRACK_DANCE_STYLES.ID,
                    TRACK_DANCE_STYLES.TRACK_ID,
                    TRACK_DANCE_STYLES.DANCE_STYLE,
                    TRACK_DANCE_STYLES.SUB_STYLE,
                    TRACK_DANCE_STYLES.IS_PRIMARY,
                    TRACK_DANCE_STYLES.CONFIDENCE,
                    TRACK_DANCE_STYLES.TEMPO_CATEGORY,
                    TRACK_DANCE_STYLES.BPM_MULTIPLIER,
                    TRACK_DANCE_STYLES.EFFECTIVE_BPM,
                    TRACK_DANCE_STYLES.CONFIRMATION_COUNT,
                    TRACK_DANCE_STYLES.IS_USER_CONFIRMED
                )
                .values(
                    id,
                    style.getTrackId(),
                    style.getDanceStyle(),
                    style.getSubStyle(),
                    style.getIsPrimary(),
                    style.getConfidence() != null ? style.getConfidence().doubleValue() : null,
                    style.getTempoCategory(),
                    style.getBpmMultiplier() != null ? style.getBpmMultiplier().doubleValue() : null,
                    style.getEffectiveBpm(),
                    style.getConfirmationCount(),
                    style.getIsUserConfirmed()
                )
                .execute();
            style.setId(id);
        } else {
            dsl.update(TRACK_DANCE_STYLES)
                .set(TRACK_DANCE_STYLES.DANCE_STYLE, style.getDanceStyle())
                .set(TRACK_DANCE_STYLES.SUB_STYLE, style.getSubStyle())
                .set(TRACK_DANCE_STYLES.IS_PRIMARY, style.getIsPrimary())
                .set(TRACK_DANCE_STYLES.CONFIDENCE, style.getConfidence() != null ? style.getConfidence().doubleValue() : null)
                .set(TRACK_DANCE_STYLES.TEMPO_CATEGORY, style.getTempoCategory())
                .set(TRACK_DANCE_STYLES.BPM_MULTIPLIER, style.getBpmMultiplier() != null ? style.getBpmMultiplier().doubleValue() : null)
                .set(TRACK_DANCE_STYLES.EFFECTIVE_BPM, style.getEffectiveBpm())
                .set(TRACK_DANCE_STYLES.CONFIRMATION_COUNT, style.getConfirmationCount())
                .set(TRACK_DANCE_STYLES.IS_USER_CONFIRMED, style.getIsUserConfirmed())
                .where(TRACK_DANCE_STYLES.ID.eq(style.getId()))
                .execute();
        }
        return style;
    }

    private TrackDanceStyle toDanceStyle(Record r) {
        TrackDanceStyle s = new TrackDanceStyle();
        s.setId(r.get(TRACK_DANCE_STYLES.ID));
        s.setTrackId(r.get(TRACK_DANCE_STYLES.TRACK_ID));
        s.setDanceStyle(r.get(TRACK_DANCE_STYLES.DANCE_STYLE));
        s.setSubStyle(r.get(TRACK_DANCE_STYLES.SUB_STYLE));
        s.setIsPrimary(r.get(TRACK_DANCE_STYLES.IS_PRIMARY));
        s.setConfidence(r.get(TRACK_DANCE_STYLES.CONFIDENCE) != null ? r.get(TRACK_DANCE_STYLES.CONFIDENCE).floatValue() : null);
        s.setTempoCategory(r.get(TRACK_DANCE_STYLES.TEMPO_CATEGORY));
        s.setBpmMultiplier(r.get(TRACK_DANCE_STYLES.BPM_MULTIPLIER) != null ? r.get(TRACK_DANCE_STYLES.BPM_MULTIPLIER).floatValue() : null);
        s.setEffectiveBpm(r.get(TRACK_DANCE_STYLES.EFFECTIVE_BPM));
        s.setConfirmationCount(r.get(TRACK_DANCE_STYLES.CONFIRMATION_COUNT));
        s.setIsUserConfirmed(r.get(TRACK_DANCE_STYLES.IS_USER_CONFIRMED));
        return s;
    }
}

