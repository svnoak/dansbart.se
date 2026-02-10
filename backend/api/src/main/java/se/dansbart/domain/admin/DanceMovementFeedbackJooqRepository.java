package se.dansbart.domain.admin;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.DANCE_MOVEMENT_FEEDBACK;

@Repository
public class DanceMovementFeedbackJooqRepository {

    private final DSLContext dsl;

    public DanceMovementFeedbackJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<DanceMovementFeedback> findByDanceStyleAndMovementTag(String danceStyle, String movementTag) {
        return dsl.selectFrom(DANCE_MOVEMENT_FEEDBACK)
            .where(DANCE_MOVEMENT_FEEDBACK.DANCE_STYLE.eq(danceStyle)
                .and(DANCE_MOVEMENT_FEEDBACK.MOVEMENT_TAG.eq(movementTag)))
            .fetchOptional(this::toFeedback);
    }

    public List<DanceMovementFeedback> findAll() {
        return dsl.selectFrom(DANCE_MOVEMENT_FEEDBACK)
            .orderBy(DANCE_MOVEMENT_FEEDBACK.DANCE_STYLE.asc(), DANCE_MOVEMENT_FEEDBACK.MOVEMENT_TAG.asc())
            .fetch(this::toFeedback);
    }

    public long count() {
        return dsl.fetchCount(DANCE_MOVEMENT_FEEDBACK);
    }

    public DanceMovementFeedback save(DanceMovementFeedback feedback) {
        if (feedback.getId() == null) {
            UUID id = UUID.randomUUID();
            dsl.insertInto(DANCE_MOVEMENT_FEEDBACK)
                .columns(
                    DANCE_MOVEMENT_FEEDBACK.ID,
                    DANCE_MOVEMENT_FEEDBACK.DANCE_STYLE,
                    DANCE_MOVEMENT_FEEDBACK.MOVEMENT_TAG,
                    DANCE_MOVEMENT_FEEDBACK.SCORE,
                    DANCE_MOVEMENT_FEEDBACK.OCCURRENCES
                )
                .values(
                    id,
                    feedback.getDanceStyle(),
                    feedback.getMovementTag(),
                    feedback.getScore() != null ? feedback.getScore().doubleValue() : null,
                    feedback.getOccurrences()
                )
                .execute();
            feedback.setId(id);
        } else {
            dsl.update(DANCE_MOVEMENT_FEEDBACK)
                .set(DANCE_MOVEMENT_FEEDBACK.SCORE, feedback.getScore() != null ? feedback.getScore().doubleValue() : null)
                .set(DANCE_MOVEMENT_FEEDBACK.OCCURRENCES, feedback.getOccurrences())
                .where(DANCE_MOVEMENT_FEEDBACK.ID.eq(feedback.getId()))
                .execute();
        }
        return feedback;
    }

    private DanceMovementFeedback toFeedback(Record r) {
        DanceMovementFeedback f = new DanceMovementFeedback();
        f.setId(r.get(DANCE_MOVEMENT_FEEDBACK.ID));
        f.setDanceStyle(r.get(DANCE_MOVEMENT_FEEDBACK.DANCE_STYLE));
        f.setMovementTag(r.get(DANCE_MOVEMENT_FEEDBACK.MOVEMENT_TAG));
        f.setScore(r.get(DANCE_MOVEMENT_FEEDBACK.SCORE) != null ? r.get(DANCE_MOVEMENT_FEEDBACK.SCORE).floatValue() : null);
        f.setOccurrences(r.get(DANCE_MOVEMENT_FEEDBACK.OCCURRENCES));
        return f;
    }
}

